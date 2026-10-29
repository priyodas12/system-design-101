// Local Amazon SQS + SNS emulator: AWS JSON protocol (SQS), query protocol (SNS) + the web console in ./public.
// Zero dependencies (Node built-ins only). State is in memory and snapshotted to DATA_DIR.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 9324);
const REGION = process.env.AWS_REGION || 'us-east-1';
const ACCOUNT = '000000000000';
const DATA_DIR = process.env.DATA_DIR || '/data';
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const MAX_BODY = 4 * 1024 * 1024;
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

class SqsError extends Error {
  constructor(code, message, legacy) {
    super(message);
    this.code = code;
    this.legacy = legacy || code;
  }
}
const bad = (m) => new SqsError('InvalidParameterValue', m);
const missing = (n) => new SqsError('MissingParameter', `The request must contain the parameter ${n}.`);

// ---------- state ----------
const DEFAULTS = {
  VisibilityTimeout: '30',
  DelaySeconds: '0',
  MessageRetentionPeriod: '345600',
  ReceiveMessageWaitTimeSeconds: '0',
  MaximumMessageSize: '262144',
};
const RANGES = {
  VisibilityTimeout: [0, 43200],
  DelaySeconds: [0, 900],
  MessageRetentionPeriod: [60, 1209600],
  ReceiveMessageWaitTimeSeconds: [0, 20],
  MaximumMessageSize: [1024, 262144],
};
const queues = new Map(); // name -> queue
let dirty = false;
let seq = 0;
const touch = () => { dirty = true; };
const now = () => Date.now();
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');

function normalizeAttrs(input, fifo) {
  const out = {};
  for (const [k, v] of Object.entries(input || {})) {
    const val = String(v);
    if (k in RANGES) {
      const n = Number(val);
      const [lo, hi] = RANGES[k];
      if (!Number.isInteger(n) || n < lo || n > hi) throw bad(`Invalid value for the parameter ${k}.`);
    } else if (k === 'RedrivePolicy') {
      let p;
      try { p = JSON.parse(val); } catch { throw bad('Invalid value for the parameter RedrivePolicy.'); }
      if (!p.deadLetterTargetArn || !Number.isInteger(Number(p.maxReceiveCount))) throw bad('Invalid value for the parameter RedrivePolicy.');
    } else if (k === 'FifoQueue' || k === 'ContentBasedDeduplication') {
      if (k === 'FifoQueue' && (val === 'true') !== fifo) throw bad('Invalid value for the parameter FifoQueue.');
      if (k === 'ContentBasedDeduplication' && !fifo) throw bad('ContentBasedDeduplication is only valid for FIFO queues.');
    } else if (!['Policy', 'KmsMasterKeyId', 'KmsDataKeyReusePeriodSeconds', 'SqsManagedSseEnabled', 'DeduplicationScope', 'FifoThroughputLimit', 'RedriveAllowPolicy'].includes(k)) {
      throw new SqsError('InvalidAttributeName', `Unknown Attribute ${k}.`);
    }
    out[k] = val;
  }
  return out;
}

const arnOf = (name) => `arn:aws:sqs:${REGION}:${ACCOUNT}:${name}`;

function getQueue(url) {
  if (!url) throw missing('QueueUrl');
  const name = decodeURIComponent(String(url).split('?')[0].split('/').filter(Boolean).pop() || '');
  const q = queues.get(name);
  if (!q) throw new SqsError('QueueDoesNotExist', 'The specified queue does not exist.', 'AWS.SimpleQueueService.NonExistentQueue');
  return q;
}

// Drop expired messages and expired dedup ids so counts stay honest.
function sweep(q, t) {
  const keep = Number(q.attrs.MessageRetentionPeriod) * 1000;
  for (const [id, m] of q.messages) if (t - m.sentAt > keep) { q.messages.delete(id); touch(); }
  for (const [id, d] of q.dedup) if (t - d.ts > DEDUP_WINDOW_MS) q.dedup.delete(id);
}

// ---------- message attributes ----------
function validateMessageAttributes(attrs) {
  for (const [name, a] of Object.entries(attrs || {})) {
    if (!a || !a.DataType) throw bad(`Message attribute ${name} must have a DataType.`);
    const base = a.DataType.split('.')[0];
    if (!['String', 'Number', 'Binary'].includes(base)) throw bad(`Message attribute ${name} has an invalid DataType.`);
    if (base === 'Binary' ? a.BinaryValue == null : a.StringValue == null) throw bad(`Message attribute ${name} must have a value.`);
  }
}

// MD5 of attributes as defined by SQS; official SDKs verify this value.
function md5OfAttributes(attrs) {
  const names = Object.keys(attrs || {}).sort();
  if (!names.length) return undefined;
  const chunks = [];
  const lenBuf = (b) => { const l = Buffer.alloc(4); l.writeUInt32BE(b.length); return Buffer.concat([l, b]); };
  for (const n of names) {
    const a = attrs[n];
    const binary = a.DataType.startsWith('Binary');
    chunks.push(lenBuf(Buffer.from(n)), lenBuf(Buffer.from(a.DataType)), Buffer.from([binary ? 2 : 1]),
      lenBuf(binary ? Buffer.from(a.BinaryValue, 'base64') : Buffer.from(a.StringValue)));
  }
  return md5(Buffer.concat(chunks));
}

// ---------- operations ----------
function enqueue(q, p, entryDelay) {
  const body = p.MessageBody;
  if (body == null || body === '') throw missing('MessageBody');
  if (Buffer.byteLength(body) > Number(q.attrs.MaximumMessageSize)) throw bad(`One or more parameters are invalid. Reason: Message must be shorter than ${q.attrs.MaximumMessageSize} bytes.`);
  validateMessageAttributes(p.MessageAttributes);
  const t = now();
  sweep(q, t);
  const fifo = q.fifo;
  let delay = p.DelaySeconds != null ? Number(p.DelaySeconds) : Number(q.attrs.DelaySeconds);
  if (!(delay >= 0 && delay <= 900)) throw bad('Value for parameter DelaySeconds is invalid.');
  let groupId, dedupId;
  if (fifo) {
    groupId = p.MessageGroupId;
    if (!groupId) throw missing('MessageGroupId');
    dedupId = p.MessageDeduplicationId || (q.attrs.ContentBasedDeduplication === 'true' ? md5(body) : undefined);
    if (!dedupId) throw bad('The queue should either have ContentBasedDeduplication enabled or MessageDeduplicationId provided explicitly.');
    delay = Number(q.attrs.DelaySeconds); // per-message delay is not supported on FIFO
    const prior = q.dedup.get(dedupId);
    if (prior && t - prior.ts <= DEDUP_WINDOW_MS) {
      return { MessageId: prior.id, MD5OfMessageBody: md5(body), MD5OfMessageAttributes: md5OfAttributes(p.MessageAttributes), SequenceNumber: prior.seq };
    }
  }
  const id = crypto.randomUUID();
  const m = {
    id, body, attrs: p.MessageAttributes || {}, sentAt: t, visibleAt: t + delay * 1000,
    receiveCount: 0, firstReceivedAt: null, receipt: null, groupId, dedupId, seq: fifo ? String(18850000000000000000n + BigInt(++seq)) : undefined,
  };
  q.messages.set(id, m);
  if (fifo) q.dedup.set(dedupId, { ts: t, id, seq: m.seq });
  touch();
  return { MessageId: id, MD5OfMessageBody: md5(body), MD5OfMessageAttributes: md5OfAttributes(m.attrs), ...(fifo && { SequenceNumber: m.seq }) };
}

function toReceived(q, m, p) {
  const want = p.MessageSystemAttributeNames || p.AttributeNames || [];
  const all = want.includes('All');
  const sys = {};
  const add = (k, v) => { if (v != null && (all || want.includes(k))) sys[k] = String(v); };
  add('SenderId', ACCOUNT);
  add('SentTimestamp', m.sentAt);
  add('ApproximateReceiveCount', m.receiveCount);
  add('ApproximateFirstReceiveTimestamp', m.firstReceivedAt);
  add('MessageGroupId', m.groupId);
  add('MessageDeduplicationId', m.dedupId);
  add('SequenceNumber', m.seq);
  const names = p.MessageAttributeNames || [];
  const ma = {};
  for (const [n, a] of Object.entries(m.attrs)) {
    if (names.some((w) => w === 'All' || w === '.*' || w === n || (w.endsWith('.*') && n.startsWith(w.slice(0, -1))))) ma[n] = a;
  }
  const out = { MessageId: m.id, ReceiptHandle: m.receipt, MD5OfBody: md5(m.body), Body: m.body };
  if (Object.keys(sys).length) out.Attributes = sys;
  if (Object.keys(ma).length) { out.MessageAttributes = ma; out.MD5OfMessageAttributes = md5OfAttributes(ma); }
  return out;
}

function takeMessages(q, p) {
  const t = now();
  sweep(q, t);
  const max = p.MaxNumberOfMessages != null ? Number(p.MaxNumberOfMessages) : 1;
  if (!(max >= 1 && max <= 10)) throw bad('Value for parameter MaxNumberOfMessages is invalid. Reason: Must be between 1 and 10, if provided.');
  const vis = p.VisibilityTimeout != null ? Number(p.VisibilityTimeout) : Number(q.attrs.VisibilityTimeout);
  if (!(vis >= 0 && vis <= 43200)) throw bad('Value for parameter VisibilityTimeout is invalid.');
  const redrive = q.attrs.RedrivePolicy ? JSON.parse(q.attrs.RedrivePolicy) : null;
  const dlq = redrive && queues.get(String(redrive.deadLetterTargetArn).split(':').pop());
  const blockedGroups = new Set();
  if (q.fifo) for (const m of q.messages.values()) if (m.receiveCount > 0 && m.visibleAt > t) blockedGroups.add(m.groupId);
  const out = [];
  for (const m of [...q.messages.values()]) {
    if (out.length >= max) break;
    if (m.visibleAt > t) continue;
    if (q.fifo && blockedGroups.has(m.groupId)) continue;
    if (dlq && m.receiveCount >= Number(redrive.maxReceiveCount)) {
      q.messages.delete(m.id);
      m.visibleAt = t; m.receiveCount = 0; m.firstReceivedAt = null; m.receipt = null;
      dlq.messages.set(m.id, m);
      touch();
      continue;
    }
    m.receiveCount++;
    if (m.firstReceivedAt == null) m.firstReceivedAt = t;
    m.visibleAt = t + vis * 1000;
    m.receipt = crypto.randomBytes(48).toString('base64url');
    if (q.fifo) blockedGroups.add(m.groupId);
    out.push(toReceived(q, m, p));
  }
  if (out.length) touch();
  return out;
}

function findByReceipt(q, handle) {
  if (!handle) throw missing('ReceiptHandle');
  for (const m of q.messages.values()) if (m.receipt === handle) return m;
  return null;
}

function batch(q, p, fn) {
  const entries = p.Entries;
  if (!entries || !entries.length) throw new SqsError('EmptyBatchRequest', 'There should be at least one entry in the request.', 'AWS.SimpleQueueService.EmptyBatchRequest');
  if (entries.length > 10) throw new SqsError('TooManyEntriesInBatchRequest', 'Maximum number of entries per request are 10.', 'AWS.SimpleQueueService.TooManyEntriesInBatchRequest');
  if (new Set(entries.map((e) => e.Id)).size !== entries.length) throw new SqsError('BatchEntryIdsNotDistinct', 'Two or more batch entries in the request have the same Id.', 'AWS.SimpleQueueService.BatchEntryIdsNotDistinct');
  const Successful = [], Failed = [];
  for (const e of entries) {
    try { Successful.push({ Id: e.Id, ...fn(e) }); }
    catch (err) {
      if (!(err instanceof SqsError)) throw err;
      Failed.push({ Id: e.Id, SenderFault: true, Code: err.code, Message: err.message });
    }
  }
  return { Successful, Failed };
}

function queueAttributes(q, names) {
  const t = now();
  sweep(q, t);
  let visible = 0, notVisible = 0, delayed = 0;
  for (const m of q.messages.values()) {
    if (m.visibleAt <= t) visible++;
    else if (m.receiveCount > 0) notVisible++;
    else delayed++;
  }
  const all = {
    ...DEFAULTS, ...q.attrs,
    ApproximateNumberOfMessages: visible, ApproximateNumberOfMessagesNotVisible: notVisible, ApproximateNumberOfMessagesDelayed: delayed,
    CreatedTimestamp: Math.floor(q.created / 1000), LastModifiedTimestamp: Math.floor(q.modified / 1000), QueueArn: arnOf(q.name),
    ...(q.fifo && { FifoQueue: 'true', ContentBasedDeduplication: q.attrs.ContentBasedDeduplication || 'false' }),
  };
  const wanted = !names || !names.length || names.includes('All') ? Object.keys(all) : names;
  const out = {};
  for (const n of wanted) if (all[n] != null) out[n] = String(all[n]);
  return out;
}

const urlBase = (req) => `http://${req.headers.host || `localhost:${PORT}`}/${ACCOUNT}`;

const actions = {
  CreateQueue(p, req) {
    const name = p.QueueName;
    if (!name) throw missing('QueueName');
    const fifo = name.endsWith('.fifo');
    if (!/^[a-zA-Z0-9_-]{1,80}(\.fifo)?$/.test(name)) throw bad('Can only include alphanumeric characters, hyphens, or underscores. 1 to 80 in length');
    const attrs = normalizeAttrs(p.Attributes || p.attributes, fifo);
    if (fifo && p.Attributes && p.Attributes.FifoQueue !== 'true') throw bad('FIFO queue names must be created with the FifoQueue attribute set to true.');
    const existing = queues.get(name);
    if (existing) {
      for (const [k, v] of Object.entries(attrs)) {
        if ((existing.attrs[k] ?? DEFAULTS[k]) !== v && k !== 'FifoQueue') throw new SqsError('QueueNameExists', 'A queue already exists with the same name and a different value for attribute ' + k, 'QueueAlreadyExists');
      }
      return { QueueUrl: `${urlBase(req)}/${name}` };
    }
    delete attrs.FifoQueue;
    queues.set(name, { name, fifo, attrs: { ...DEFAULTS, ...attrs }, created: now(), modified: now(), messages: new Map(), dedup: new Map() });
    touch();
    return { QueueUrl: `${urlBase(req)}/${name}` };
  },
  DeleteQueue(p) { queues.delete(getQueue(p.QueueUrl).name); touch(); return {}; },
  GetQueueUrl(p, req) {
    if (!p.QueueName) throw missing('QueueName');
    if (!queues.has(p.QueueName)) throw new SqsError('QueueDoesNotExist', 'The specified queue does not exist.', 'AWS.SimpleQueueService.NonExistentQueue');
    return { QueueUrl: `${urlBase(req)}/${p.QueueName}` };
  },
  ListQueues(p, req) {
    const prefix = p.QueueNamePrefix || '';
    const urls = [...queues.keys()].filter((n) => n.startsWith(prefix)).sort().map((n) => `${urlBase(req)}/${n}`);
    return urls.length ? { QueueUrls: urls } : {};
  },
  GetQueueAttributes(p) { return { Attributes: queueAttributes(getQueue(p.QueueUrl), p.AttributeNames) }; },
  SetQueueAttributes(p) {
    const q = getQueue(p.QueueUrl);
    const attrs = normalizeAttrs(p.Attributes, q.fifo);
    delete attrs.FifoQueue;
    for (const [k, v] of Object.entries(attrs)) { if (v === '' && k === 'RedrivePolicy') delete q.attrs[k]; else q.attrs[k] = v; }
    q.modified = now();
    touch();
    return {};
  },
  PurgeQueue(p) { const q = getQueue(p.QueueUrl); q.messages.clear(); touch(); return {}; },
  SendMessage(p) { return enqueue(getQueue(p.QueueUrl), p); },
  SendMessageBatch(p) { const q = getQueue(p.QueueUrl); return batch(q, p, (e) => enqueue(q, e)); },
  DeleteMessage(p) {
    const q = getQueue(p.QueueUrl);
    const m = findByReceipt(q, p.ReceiptHandle);
    if (!m && !/^[A-Za-z0-9_-]{16,}$/.test(p.ReceiptHandle)) throw new SqsError('ReceiptHandleIsInvalid', 'The input receipt handle is invalid.');
    if (m) { q.messages.delete(m.id); touch(); }
    return {};
  },
  DeleteMessageBatch(p) {
    const q = getQueue(p.QueueUrl);
    return batch(q, p, (e) => { actions.DeleteMessage({ QueueUrl: p.QueueUrl, ReceiptHandle: e.ReceiptHandle }); return {}; });
  },
  ChangeMessageVisibility(p) {
    const q = getQueue(p.QueueUrl);
    const m = findByReceipt(q, p.ReceiptHandle);
    const vt = Number(p.VisibilityTimeout);
    if (!(vt >= 0 && vt <= 43200)) throw bad('Value for parameter VisibilityTimeout is invalid.');
    if (!m) throw new SqsError('ReceiptHandleIsInvalid', 'The input receipt handle is invalid.');
    if (m.visibleAt <= now()) throw new SqsError('MessageNotInflight', 'Message is not in flight.', 'AWS.SimpleQueueService.MessageNotInflight');
    m.visibleAt = now() + vt * 1000;
    touch();
    return {};
  },
  ChangeMessageVisibilityBatch(p) {
    const q = getQueue(p.QueueUrl);
    return batch(q, p, (e) => { actions.ChangeMessageVisibility({ QueueUrl: p.QueueUrl, ReceiptHandle: e.ReceiptHandle, VisibilityTimeout: e.VisibilityTimeout }); return {}; });
  },
  ListDeadLetterSourceQueues(p, req) {
    const q = getQueue(p.QueueUrl);
    const urls = [...queues.values()]
      .filter((s) => s.attrs.RedrivePolicy && JSON.parse(s.attrs.RedrivePolicy).deadLetterTargetArn === arnOf(q.name))
      .map((s) => `${urlBase(req)}/${s.name}`);
    return { queueUrls: urls };
  },
};

// Long polling: re-check every 50 ms until a message shows up, the wait expires, or the client leaves.
function receive(p, req) {
  const q = getQueue(p.QueueUrl);
  const wait = p.WaitTimeSeconds != null ? Number(p.WaitTimeSeconds) : Number(q.attrs.ReceiveMessageWaitTimeSeconds);
  if (!(wait >= 0 && wait <= 20)) throw bad('Value for parameter WaitTimeSeconds is invalid. Reason: Must be >= 0 and <= 20, if provided.');
  const first = takeMessages(q, p);
  if (first.length || !wait) return Promise.resolve(first.length ? { Messages: first } : {});
  const deadline = now() + wait * 1000;
  return new Promise((resolve) => {
    let gone = false;
    req.on('close', () => { gone = true; });
    const tick = () => {
      if (gone) return resolve({});
      if (!queues.has(q.name)) return resolve({});
      const got = takeMessages(q, p);
      if (got.length) return resolve({ Messages: got });
      if (now() >= deadline) return resolve({});
      setTimeout(tick, 50);
    };
    setTimeout(tick, 50);
  });
}

// ---------- SNS ----------
const topics = new Map(); // name -> { name, fifo, attrs, created, subs: Map(arn -> sub), dedup: Map }
const deliveries = []; // newest first; the "inbox" for protocols we cannot really reach (email, sms) and a log for the rest
const snsArn = (name) => `arn:aws:sns:${REGION}:${ACCOUNT}:${name}`;
const snsBad = (m) => new SqsError('InvalidParameter', `Invalid parameter: ${m}`);
const notFound = (m) => new SqsError('NotFound', m);
const PROTOCOLS = ['sqs', 'http', 'https', 'email', 'email-json', 'sms'];

function logDelivery(sub, topic, status, detail, extra = {}) {
  deliveries.unshift({ ts: now(), topicArn: snsArn(topic.name), subscriptionArn: sub.arn, protocol: sub.protocol, endpoint: sub.endpoint, status, detail: String(detail || '').slice(0, 4000), ...extra });
  if (deliveries.length > 300) deliveries.pop();
}

function getTopic(arn) {
  if (!arn) throw snsBad('TopicArn');
  const t = topics.get(String(arn).split(':').pop());
  if (!t || snsArn(t.name) !== arn) throw notFound('Topic does not exist');
  return t;
}

function topicAttributes(t) {
  const subs = [...t.subs.values()];
  return {
    TopicArn: snsArn(t.name), Owner: ACCOUNT, DisplayName: t.attrs.DisplayName || '',
    SubscriptionsConfirmed: String(subs.filter((s) => s.confirmed).length), SubscriptionsPending: String(subs.filter((s) => !s.confirmed).length), SubscriptionsDeleted: '0',
    ...(t.fifo && { FifoTopic: 'true', ContentBasedDeduplication: t.attrs.ContentBasedDeduplication || 'false' }),
  };
}

const subView = (s) => ({ SubscriptionArn: s.confirmed ? s.arn : 'PendingConfirmation', Owner: ACCOUNT, Protocol: s.protocol, Endpoint: s.endpoint, TopicArn: s.topicArn });

function subAttributes(s) {
  return {
    SubscriptionArn: s.arn, TopicArn: s.topicArn, Owner: ACCOUNT, Protocol: s.protocol, Endpoint: s.endpoint,
    ConfirmationWasAuthenticated: String(s.confirmed), PendingConfirmation: String(!s.confirmed),
    RawMessageDelivery: s.attrs.RawMessageDelivery || 'false', FilterPolicyScope: s.attrs.FilterPolicyScope || 'MessageAttributes',
    ...(s.attrs.FilterPolicy && { FilterPolicy: s.attrs.FilterPolicy }),
  };
}

function normalizeSubAttrs(input) {
  const out = {};
  for (const [k, v] of Object.entries(input || {})) {
    const val = String(v);
    if (k === 'RawMessageDelivery') { if (!['true', 'false'].includes(val)) throw snsBad('RawMessageDelivery must be true or false'); }
    else if (k === 'FilterPolicy') {
      if (val !== '') { try { const o = JSON.parse(val); if (!o || typeof o !== 'object' || Array.isArray(o)) throw 0; } catch { throw snsBad('FilterPolicy: failed to parse JSON object'); } }
    } else if (k === 'FilterPolicyScope') { if (!['MessageAttributes', 'MessageBody'].includes(val)) throw snsBad('FilterPolicyScope must be MessageAttributes or MessageBody'); }
    else if (!['RedrivePolicy', 'DeliveryPolicy'].includes(k)) throw snsBad(`AttributeName: ${k}`);
    out[k] = val;
  }
  return out;
}

function findSub(arn) {
  for (const t of topics.values()) if (t.subs.has(arn)) return [t, t.subs.get(arn)];
  throw notFound('Subscription does not exist');
}

// ----- filter policies -----
function ruleMatches(rule, val) {
  if (rule !== null && typeof rule === 'object') {
    const [op, arg] = Object.entries(rule)[0] || [];
    if (op === 'exists') return (val !== undefined) === !!arg;
    if (val === undefined) return false;
    const s = String(val);
    if (op === 'prefix') return s.startsWith(arg);
    if (op === 'suffix') return s.endsWith(arg);
    if (op === 'equals-ignore-case') return s.toLowerCase() === String(arg).toLowerCase();
    if (op === 'anything-but') return ![].concat(arg).some((r) => (typeof r === 'object' ? ruleMatches(r, val) : String(r) === s));
    if (op === 'numeric') {
      const n = Number(val);
      if (Number.isNaN(n)) return false;
      for (let i = 0; i < arg.length; i += 2) {
        const c = Number(arg[i + 1]);
        if (!({ '=': n === c, '<': n < c, '<=': n <= c, '>': n > c, '>=': n >= c })[arg[i]]) return false;
      }
      return true;
    }
    return false;
  }
  return val !== undefined && String(rule) === String(val);
}

// vals: every value the message has for this key (a JSON array in the body gives several).
const fieldMatches = (rules, vals) => (vals.length ? vals : [undefined]).some((v) => rules.some((r) => ruleMatches(r, v)));

function policyMatches(policy, getVals, body) {
  return Object.entries(policy).every(([k, rules]) => {
    if (Array.isArray(rules)) return fieldMatches(rules, getVals(k, body));
    // Nested object only occurs for MessageBody scope.
    const child = body && typeof body === 'object' ? body[k] : undefined;
    return child !== undefined && policyMatches(rules, getVals, child);
  });
}

function passesFilter(sub, m) {
  if (!sub.attrs.FilterPolicy) return true;
  const policy = JSON.parse(sub.attrs.FilterPolicy);
  if ((sub.attrs.FilterPolicyScope || 'MessageAttributes') === 'MessageBody') {
    let body; try { body = JSON.parse(m.message); } catch { return false; }
    return policyMatches(policy, (k, b) => (b && b[k] !== undefined ? [].concat(b[k]) : []), body);
  }
  return policyMatches(policy, (k) => {
    const a = m.attrs[k];
    if (!a) return [];
    if (a.DataType === 'String.Array') { try { return JSON.parse(a.StringValue); } catch { return []; } }
    return [a.StringValue];
  });
}

// ----- delivery -----
function envelope(topic, m, text, host, sub) {
  const e = {
    Type: 'Notification', MessageId: m.id, TopicArn: snsArn(topic.name), ...(m.subject && { Subject: m.subject }), Message: text,
    Timestamp: new Date(m.ts).toISOString(), SignatureVersion: '1', Signature: 'EXAMPLE',
    SigningCertURL: `https://sns.${REGION}.amazonaws.com/SimpleNotificationService-0000000000000000000000.pem`,
    UnsubscribeURL: `http://${host}/?Action=Unsubscribe&SubscriptionArn=${sub.arn}`,
  };
  const ma = Object.entries(m.attrs);
  if (ma.length) e.MessageAttributes = Object.fromEntries(ma.map(([k, a]) => [k, { Type: a.DataType, Value: a.StringValue ?? a.BinaryValue }]));
  return e;
}

function postHttp(sub, topic, type, bodyObj, bodyText, id) {
  return fetch(sub.endpoint, {
    method: 'POST', signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'x-amz-sns-message-type': type, 'x-amz-sns-message-id': id, 'x-amz-sns-topic-arn': snsArn(topic.name), 'x-amz-sns-subscription-arn': sub.arn, 'User-Agent': 'Amazon Simple Notification Service Agent' },
    body: bodyText ?? JSON.stringify(bodyObj),
  }).then((r) => ({ ok: r.ok, status: r.status }));
}

function deliver(topic, m, host) {
  for (const sub of topic.subs.values()) {
    if (!sub.confirmed) continue;
    if (!passesFilter(sub, m)) { logDelivery(sub, topic, 'filtered', 'Did not match the subscription filter policy', { messageId: m.id }); continue; }
    const text = m.structure ? (m.structure[sub.protocol] ?? m.structure.default ?? m.message) : m.message;
    const raw = sub.attrs.RawMessageDelivery === 'true';
    try {
      if (sub.protocol === 'sqs') {
        const q = queues.get(sub.endpoint.split(':').pop());
        if (!q) throw new Error('Destination queue no longer exists');
        enqueue(q, {
          MessageBody: raw ? text : JSON.stringify(envelope(topic, m, text, host, sub)),
          MessageAttributes: raw ? m.attrs : undefined,
          MessageGroupId: m.groupId || 'sns', MessageDeduplicationId: m.dedupId || m.id,
        });
        logDelivery(sub, topic, 'delivered', raw ? text : 'JSON envelope', { messageId: m.id });
      } else if (sub.protocol === 'http' || sub.protocol === 'https') {
        postHttp(sub, topic, 'Notification', raw ? null : envelope(topic, m, text, host, sub), raw ? text : null, m.id)
          .then((r) => logDelivery(sub, topic, r.ok ? 'delivered' : 'failed', `HTTP ${r.status}`, { messageId: m.id }))
          .catch((e) => logDelivery(sub, topic, 'failed', e.message, { messageId: m.id }));
      } else if (sub.protocol === 'email-json') {
        logDelivery(sub, topic, 'delivered', JSON.stringify(envelope(topic, m, text, host, sub), null, 2), { messageId: m.id, subject: m.subject });
      } else {
        logDelivery(sub, topic, 'delivered', text, { messageId: m.id, subject: m.subject });
      }
    } catch (e) { logDelivery(sub, topic, 'failed', e.message, { messageId: m.id }); }
  }
}

function publishOne(t, p, host) {
  const message = p.Message;
  if (message == null || message === '') throw snsBad('Empty message');
  if (Buffer.byteLength(message) > 262144) throw snsBad('Message too long');
  if (p.Subject != null && (p.Subject.length > 100 || /[\r\n]/.test(p.Subject))) throw snsBad('Subject must be at most 100 characters on a single line');
  validateMessageAttributes(p.MessageAttributes);
  let structure;
  if (p.MessageStructure === 'json') {
    try { structure = JSON.parse(message); } catch { throw snsBad('Message Structure - JSON message body failed to parse'); }
    if (typeof structure.default !== 'string') throw snsBad('Message Structure - No default entry in JSON message body');
  }
  const ts = now();
  let groupId, dedupId;
  if (t.fifo) {
    groupId = p.MessageGroupId;
    if (!groupId) throw snsBad('The MessageGroupId parameter is required for FIFO topics');
    dedupId = p.MessageDeduplicationId || (t.attrs.ContentBasedDeduplication === 'true' ? md5(message) : undefined);
    if (!dedupId) throw snsBad('The topic should either have ContentBasedDeduplication enabled or MessageDeduplicationId provided explicitly');
    for (const [k, d] of t.dedup) if (ts - d.ts > DEDUP_WINDOW_MS) t.dedup.delete(k);
    const prior = t.dedup.get(dedupId);
    if (prior) return { MessageId: prior.id, SequenceNumber: prior.seq };
  }
  const m = { id: crypto.randomUUID(), ts, message, subject: p.Subject, structure, attrs: p.MessageAttributes || {}, groupId, dedupId };
  const out = { MessageId: m.id };
  if (t.fifo) { out.SequenceNumber = String(18850000000000000000n + BigInt(++seq)); t.dedup.set(dedupId, { ts, id: m.id, seq: out.SequenceNumber }); }
  deliver(t, m, host);
  touch();
  return out;
}

const hostOf = (req) => req.headers.host || `localhost:${PORT}`;

const snsActions = {
  CreateTopic(p) {
    const name = p.Name;
    if (!name) throw snsBad('Name');
    const fifo = name.endsWith('.fifo');
    if (!/^[a-zA-Z0-9_-]{1,256}(\.fifo)?$/.test(name)) throw snsBad('Topic Name');
    const attrs = {};
    for (const [k, v] of Object.entries(p.Attributes || {})) {
      if (k === 'FifoTopic') { if ((String(v) === 'true') !== fifo) throw snsBad('Invalid parameter: Attributes Reason: FifoTopic must match the .fifo suffix'); }
      else if (k === 'ContentBasedDeduplication') { if (!fifo) throw snsBad('ContentBasedDeduplication is only valid for FIFO topics'); attrs[k] = String(v); }
      else if (k === 'DisplayName') attrs[k] = String(v);
      else if (!['Policy', 'DeliveryPolicy', 'KmsMasterKeyId', 'SignatureVersion', 'TracingConfig', 'FifoThroughputScope'].includes(k)) throw snsBad(`Attributes Reason: Invalid attribute ${k}`);
    }
    if (fifo && (p.Attributes || {}).FifoTopic !== 'true') throw snsBad('Invalid parameter: Attributes Reason: Fifo Topic names must be created with the FifoTopic attribute');
    if (!topics.has(name)) { topics.set(name, { name, fifo, attrs, created: now(), subs: new Map(), dedup: new Map() }); touch(); }
    return { TopicArn: snsArn(name) };
  },
  DeleteTopic(p) { const t = getTopic(p.TopicArn); topics.delete(t.name); touch(); return {}; },
  ListTopics() { return { Topics: [...topics.keys()].sort().map((n) => ({ TopicArn: snsArn(n) })) }; },
  GetTopicAttributes(p) { return { Attributes: topicAttributes(getTopic(p.TopicArn)) }; },
  SetTopicAttributes(p) {
    const t = getTopic(p.TopicArn);
    if (!p.AttributeName) throw snsBad('AttributeName');
    if (!['DisplayName', 'ContentBasedDeduplication', 'Policy', 'DeliveryPolicy'].includes(p.AttributeName)) throw snsBad(`AttributeName: ${p.AttributeName}`);
    t.attrs[p.AttributeName] = String(p.AttributeValue ?? '');
    touch();
    return {};
  },
  Subscribe(p, req) {
    const t = getTopic(p.TopicArn);
    const protocol = String(p.Protocol || '').toLowerCase();
    const endpoint = p.Endpoint;
    if (!PROTOCOLS.includes(protocol)) throw snsBad(`Protocol: ${p.Protocol}. Supported: ${PROTOCOLS.join(', ')}`);
    if (!endpoint) throw snsBad('Endpoint');
    if (protocol === 'sqs') {
      const m = /^arn:aws:sqs:[^:]+:\d+:([^:]+)$/.exec(endpoint);
      if (!m) throw snsBad('SQS endpoint ARN');
      if (!queues.has(m[1])) throw snsBad(`SQS endpoint ARN: queue ${m[1]} does not exist`);
      if (t.fifo !== queues.get(m[1]).fifo) throw snsBad('Invalid parameter: Endpoint Reason: FIFO SQS Queues can not be subscribed to standard SNS topics (and vice versa)');
    } else if (protocol === 'http' || protocol === 'https') {
      let u; try { u = new URL(endpoint); } catch { throw snsBad('Endpoint must be a valid URL'); }
      if (u.protocol.slice(0, -1) !== protocol) throw snsBad(`Endpoint must start with ${protocol}://`);
    } else if (protocol.startsWith('email')) {
      if (!/^[^@\s]+@[^@\s]+$/.test(endpoint)) throw snsBad('Email address');
    } else if (!/^\+?\d{7,15}$/.test(endpoint)) throw snsBad('Phone number');
    if (t.fifo && !['sqs'].includes(protocol)) throw snsBad('FIFO topics only support the sqs protocol');
    const attrs = normalizeSubAttrs(p.Attributes);
    const existing = [...t.subs.values()].find((s) => s.protocol === protocol && s.endpoint === endpoint);
    if (existing) return { SubscriptionArn: existing.confirmed ? existing.arn : 'pending confirmation' };
    const web = protocol === 'http' || protocol === 'https';
    const sub = { arn: `${snsArn(t.name)}:${crypto.randomUUID()}`, topicArn: snsArn(t.name), protocol, endpoint, attrs, confirmed: !web, token: web ? crypto.randomBytes(16).toString('hex') : null, created: now() };
    t.subs.set(sub.arn, sub);
    touch();
    if (web) {
      const host = hostOf(req);
      const body = {
        Type: 'SubscriptionConfirmation', MessageId: crypto.randomUUID(), Token: sub.token, TopicArn: sub.topicArn,
        Message: `You have chosen to subscribe to the topic ${sub.topicArn}.\nTo confirm the subscription, visit the SubscribeURL included in this message.`,
        SubscribeURL: `http://${host}/?Action=ConfirmSubscription&TopicArn=${sub.topicArn}&Token=${sub.token}`,
        Timestamp: new Date().toISOString(), SignatureVersion: '1', Signature: 'EXAMPLE', SigningCertURL: `https://sns.${REGION}.amazonaws.com/SimpleNotificationService-0000000000000000000000.pem`,
      };
      postHttp(sub, t, 'SubscriptionConfirmation', body, null, body.MessageId)
        .then((r) => logDelivery(sub, t, r.ok ? 'delivered' : 'failed', `Subscription confirmation request: HTTP ${r.status}`))
        .catch((e) => logDelivery(sub, t, 'failed', `Subscription confirmation request: ${e.message}`));
      return { SubscriptionArn: 'pending confirmation' };
    }
    return { SubscriptionArn: sub.arn };
  },
  ConfirmSubscription(p) {
    const t = getTopic(p.TopicArn);
    const sub = [...t.subs.values()].find((s) => s.token && s.token === p.Token);
    if (!sub) throw snsBad('Token');
    sub.confirmed = true;
    touch();
    return { SubscriptionArn: sub.arn };
  },
  Unsubscribe(p) { const [t, s] = findSub(p.SubscriptionArn); t.subs.delete(s.arn); touch(); return {}; },
  ListSubscriptions() { return { Subscriptions: [...topics.values()].flatMap((t) => [...t.subs.values()].map(subView)) }; },
  ListSubscriptionsByTopic(p) { return { Subscriptions: [...getTopic(p.TopicArn).subs.values()].map(subView) }; },
  GetSubscriptionAttributes(p) { return { Attributes: subAttributes(findSub(p.SubscriptionArn)[1]) }; },
  SetSubscriptionAttributes(p) {
    const s = findSub(p.SubscriptionArn)[1];
    if (!p.AttributeName) throw snsBad('AttributeName');
    const a = normalizeSubAttrs({ [p.AttributeName]: p.AttributeValue ?? '' });
    if (a[p.AttributeName] === '') delete s.attrs[p.AttributeName]; else Object.assign(s.attrs, a);
    touch();
    return {};
  },
  Publish(p, req) { return publishOne(getTopic(p.TopicArn || p.TargetArn), p, hostOf(req)); },
  PublishBatch(p, req) {
    const t = getTopic(p.TopicArn);
    const entries = p.PublishBatchRequestEntries;
    if (!entries || !entries.length) throw new SqsError('EmptyBatchRequest', 'The batch request doesn\'t contain any entries.');
    if (entries.length > 10) throw new SqsError('TooManyEntriesInBatchRequest', 'The batch request contains more entries than permissible.');
    if (new Set(entries.map((e) => e.Id)).size !== entries.length) throw new SqsError('BatchEntryIdsNotDistinct', 'Two or more batch entries in the request have the same Id.');
    const Successful = [], Failed = [];
    for (const e of entries) {
      try { Successful.push({ Id: e.Id, ...publishOne(t, e, hostOf(req)) }); }
      catch (err) { if (!(err instanceof SqsError)) throw err; Failed.push({ Id: e.Id, Code: err.code, Message: err.message, SenderFault: true }); }
    }
    return { Successful, Failed };
  },
  // Not an AWS API: console-only view of the delivery log / email-sms sandbox inbox.
  ListDeliveryLog(p) { return { Deliveries: p.TopicArn ? deliveries.filter((d) => d.topicArn === p.TopicArn) : deliveries }; },
};

// ----- Query protocol (form-encoded in, XML out): what the AWS CLI and SDKs use for SNS -----
function formToParams(body) {
  const root = {};
  for (const [k, v] of new URLSearchParams(body)) {
    const segs = k.split('.');
    let o = root;
    segs.forEach((s, i) => { if (i === segs.length - 1) o[s] = v; else o = o[s] = o[s] || {}; });
  }
  const norm = (v) => {
    if (typeof v !== 'object') return v;
    const ks = Object.keys(v);
    if (ks.length && ks.every((k) => /^\d+$/.test(k))) return ks.sort((a, b) => a - b).map((k) => norm(v[k]));
    const o = Object.fromEntries(ks.map((k) => [k, norm(v[k])]));
    if (ks.length === 1 && (ks[0] === 'entry' || ks[0] === 'member')) return o[ks[0]];
    return o;
  };
  const fix = (o) => {
    if (Array.isArray(o)) return o.map(fix);
    if (!o || typeof o !== 'object') return o;
    for (const k of Object.keys(o)) o[k] = fix(o[k]);
    if (Array.isArray(o.Attributes)) o.Attributes = Object.fromEntries(o.Attributes.map((e) => [e.key, e.value]));
    if (Array.isArray(o.MessageAttributes)) o.MessageAttributes = Object.fromEntries(o.MessageAttributes.map((e) => [e.Name, e.Value]));
    return o;
  };
  return fix(norm(root));
}

const xe = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
function toXml(v) {
  if (Array.isArray(v)) return v.map((x) => `<member>${toXml(x)}</member>`).join('');
  if (v && typeof v === 'object') {
    return Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => (k === 'Attributes'
      ? `<Attributes>${Object.entries(x).map(([a, b]) => `<entry><key>${xe(a)}</key><value>${xe(b)}</value></entry>`).join('')}</Attributes>`
      : `<${k}>${toXml(x)}</${k}>`)).join('');
  }
  return xe(v);
}

const XMLNS = 'http://sns.amazonaws.com/doc/2010-03-31/';
function sendXml(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/xml', 'Content-Length': Buffer.byteLength(body), 'x-amzn-RequestId': crypto.randomUUID() });
  res.end(body);
}

function runQuery(res, req, params) {
  const op = params.Action;
  const rid = crypto.randomUUID();
  try {
    if (!snsActions[op] || op === 'ListDeliveryLog') throw new SqsError('InvalidAction', `Action ${op} is not supported. This endpoint speaks the SNS query protocol; for SQS use the JSON protocol (a recent AWS CLI/SDK).`);
    const result = snsActions[op](params, req);
    const inner = Object.keys(result).length ? `<${op}Result>${toXml(result)}</${op}Result>` : '';
    sendXml(res, 200, `<${op}Response xmlns="${XMLNS}">${inner}<ResponseMetadata><RequestId>${rid}</RequestId></ResponseMetadata></${op}Response>`);
  } catch (err) {
    if (!(err instanceof SqsError)) { console.error(err); err = new SqsError('InternalFailure', 'Internal error'); }
    sendXml(res, err.code === 'NotFound' ? 404 : err.code === 'InternalFailure' ? 500 : 400,
      `<ErrorResponse xmlns="${XMLNS}"><Error><Type>Sender</Type><Code>${xe(err.code)}</Code><Message>${xe(err.message)}</Message></Error><RequestId>${rid}</RequestId></ErrorResponse>`);
  }
}

// ---------- HTTP ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/x-amz-json-1.0', 'Content-Length': Buffer.byteLength(body), 'x-amzn-RequestId': crypto.randomUUID(), ...headers });
  res.end(body);
}

function sendError(res, err) {
  if (err instanceof SqsError) {
    return send(res, 400, { __type: `com.amazonaws.sqs#${err.code}`, message: err.message }, { 'x-amzn-query-error': `${err.legacy};Sender` });
  }
  console.error(err);
  send(res, 500, { __type: 'com.amazonaws.sqs#InternalError', message: 'Internal error' });
}

const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/health') { res.writeHead(200); return res.end('ok'); }
  const target = req.headers['x-amz-target'];
  if (req.method === 'POST' && target) {
    const [svc, op] = target.split('.');
    const isSns = svc === 'AmazonSNS' || svc === 'SNS_20100331';
    if (svc !== 'AmazonSQS' && !isSns) return sendError(res, new SqsError('UnsupportedOperation', `Unknown target ${target}`));
    try {
      const raw = await readBody(req);
      const p = raw ? JSON.parse(raw) : {};
      if (isSns) {
        if (!snsActions[op]) throw new SqsError('InvalidAction', `Operation ${op} is not supported by this emulator.`);
        return send(res, 200, snsActions[op](p, req));
      }
      if (op === 'ReceiveMessage') return send(res, 200, await receive(p, req));
      if (!actions[op]) throw new SqsError('UnsupportedOperation', `Operation ${op} is not supported by this emulator.`, 'AWS.SimpleQueueService.UnsupportedOperation');
      if (p.QueueUrl && !p.QueueUrl.includes('/')) p.QueueUrl = `/${p.QueueUrl}`;
      return send(res, 200, actions[op](p, req));
    } catch (e) {
      if (e instanceof SyntaxError) return sendError(res, new SqsError('InvalidParameterValue', 'Request body is not valid JSON.'));
      return sendError(res, e);
    }
  }
  if (req.method === 'POST') {
    // Form-encoded "query" protocol: SNS is served from it; SQS only speaks JSON here.
    return runQuery(res, req, formToParams(await readBody(req)));
  }
  if (req.method === 'GET' && url.searchParams.get('Action')) {
    // SubscribeURL / UnsubscribeURL links from SNS messages.
    return runQuery(res, req, Object.fromEntries(url.searchParams));
  }
  if (req.method === 'GET') {
    const rel = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.normalize(path.join(PUBLIC, rel));
    if (file.startsWith(PUBLIC + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      return fs.createReadStream(file).pipe(res);
    }
  }
  res.writeHead(404); res.end('Not found');
}

// ---------- persistence ----------
function save() {
  if (!dirty) return;
  dirty = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const snap = [...queues.values()].map((q) => ({ ...q, messages: [...q.messages.values()], dedup: [...q.dedup] }));
    const tsnap = [...topics.values()].map((t) => ({ ...t, subs: [...t.subs.values()], dedup: [...t.dedup] }));
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ seq, queues: snap, topics: tsnap }));
    fs.renameSync(tmp, STATE_FILE);
  } catch (e) { console.error('snapshot failed:', e.message); dirty = true; }
}

function load() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    seq = s.seq || 0;
    for (const q of s.queues) queues.set(q.name, { ...q, attrs: { ...DEFAULTS, ...q.attrs }, messages: new Map(q.messages.map((m) => [m.id, m])), dedup: new Map(q.dedup.map(([k, v]) => [k, v])) });
    for (const t of s.topics || []) topics.set(t.name, { ...t, subs: new Map(t.subs.map((x) => [x.arn, x])), dedup: new Map(t.dedup) });
    console.log(`restored ${queues.size} queue(s), ${topics.size} topic(s) from ${STATE_FILE}`);
  } catch (e) { if (e.code !== 'ENOENT') console.error('could not restore state:', e.message); }
}

load();
setInterval(save, 2000).unref();
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { dirty = true; save(); process.exit(0); });

http.createServer((req, res) => handle(req, res).catch((e) => sendError(res, e))).listen(PORT, () => {
  console.log(`SQS + SNS local listening on :${PORT} (console: http://localhost:${PORT}/)`);
});
