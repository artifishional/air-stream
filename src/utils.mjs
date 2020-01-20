export function prop(property) {
  return (data) => data[property];
}

export function series(done, assert) {
  if (!assert.length) setTimeout(done);
  let count = 0;
  let id;
  return function (...args) {
    if (assert[count] === undefined) {
      return expect(count).toEqual(8);
    }
    assert[count](...args);
    count += 1;
    assert.length === count && (id = setTimeout(done));
    if (count > assert.length) {
      clearTimeout(id);
      expect('count done test').toEqual(assert.length);
    }
  };
}

const deepEqual = function (x, y) {
  if (x === y) {
    return true;
  } if ((typeof x === 'object' && x != null) && (typeof y === 'object' && y != null)) {
    if (Object.keys(x).length !== Object.keys(y).length) { return false; }

    for (const prop in x) {
      if (y.hasOwnProperty(prop)) {
        if (!deepEqual(x[prop], y[prop])) { return false; }
      } else { return false; }
    }

    return true;
  } return false;
};

export const streamEqual = (done, source, data = [], options = {}) => {
  const defaultOptions = {
    delta: 100, // ms
    timeout: null,
  };

  expect.hasAssertions();

  options = { ...defaultOptions, ...options };
  const start = Date.now();

  const lastMsgTime = data.reduce((acc, msg) => (!msg.t ? 0 : msg.t > acc ? msg.t : acc), 0);
  jest.setTimeout(options.timeout || (lastMsgTime + options.delta + 1));
  const doneTimer = setTimeout(() => {
    expect(data.some((assert) => !assert.pass)).toBeFalsy();
    done();
  }, options.timeout || lastMsgTime + options.delta);

  return source.connect(() => (msg) => {
    data.map((assert) => {
      if (!assert.pass) {
        const now = Date.now() - start;
        if (assert.t) {
          assert.pass = deepEqual(assert.data, msg) && Math.abs(assert.t - now) < options.delta;
        } else {
          assert.pass = deepEqual(assert.data, msg);
        }
      }
    });
  });
};

const DEFAULT_OPTIONS = {
  delta: 100, // ms
  timeout: null,
};

export function async() {
  let gen = Promise.resolve();
  return (next) => gen = gen.then(next);
}

export const streamEqualStrict = (done, source, data = [], options = {}) => {
  // set default timeout
  jest.setTimeout(5000);
  const counterCallback = jest.fn();

  const assertions = data.reduce((acc, { data }) => acc + (data ? 1 : 0), 0);
  const assertionsWithTCount = data.filter((assertion) => assertion.t).length;
  // expect.assertions(assertions + assertionsWithTCount + 1);

  options = { ...DEFAULT_OPTIONS, ...options };
  const start = Date.now();
  data.sort((a, b) => a.t - b.t);
  const lastMsgTime = data.reduce((acc, msg) => (msg.t > acc ? msg.t : acc), 0);
  let doneTimer;
  if (lastMsgTime) {
    jest.setTimeout(options.timeout || (lastMsgTime + options.delta + 1));
    doneTimer = setTimeout(() => {
      expect(counterCallback).toHaveBeenCalledTimes(assertions);
      done();
    }, options.timeout || (lastMsgTime + options.delta));
  }

  return source.connect(() => (msg) => {
    const assert = data.shift();

    if (data[0] && data[0].disconnect) {
      source.on(([a, b]) => { })();
    }
    if (typeof assert === 'undefined') {
      clearTimeout(doneTimer);
      done();
    } else if (assert.data) {
      const now = Date.now() - start;
      counterCallback();
      expect(assert.data).toEqual(msg);
      if (assert.t) {
        expect(Math.abs(assert.t - now)).toBeLessThanOrEqual(options.delta);
      }
    }
    if (data.length === 0) {
      expect(counterCallback).toHaveBeenCalledTimes(assertions);
      done();
    }
  });
};
