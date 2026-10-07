import assert from "node:assert/strict";
import test from "node:test";
import { loadWebsite, canRecoverQuicFailure } from "@/main/services/navigation";

const url = "https://www.google.com/";
const quicError = Object.assign(new Error("ERR_QUIC_PROTOCOL_ERROR"), {
  errno: -356,
});

test("normal navigation does not retry and releases its recovery state", async () => {
  let calls = 0;
  const contents = {
    isDestroyed: () => false,
    loadURL: async () => {
      calls++;
    },
  };
  await loadWebsite(contents, url);
  assert.equal(calls, 1);
  assert.equal(canRecoverQuicFailure(contents, -356), false);
});

test("one QUIC failure delays the error page and retries the same GET once", async () => {
  const calls: string[] = [];
  const contents = {
    isDestroyed: () => false,
    loadURL: async (address: string) => {
      calls.push(address);
      assert.equal(canRecoverQuicFailure(contents, -356), calls.length === 1);
      if (calls.length === 1) throw quicError;
    },
  };
  await loadWebsite(contents, url);
  assert.deepEqual(calls, [url, url]);
  assert.equal(canRecoverQuicFailure(contents, -356), false);
});

test("persistent QUIC failures propagate after two attempts, never loop", async () => {
  let calls = 0;
  const contents = {
    isDestroyed: () => false,
    loadURL: async () => {
      calls++;
      throw quicError;
    },
  };
  await assert.rejects(loadWebsite(contents, url), quicError);
  assert.equal(calls, 2);
  assert.equal(canRecoverQuicFailure(contents, -356), false);
});

test("cancellations, TLS and other network failures are never retried", async () => {
  for (const errno of [-3, -105, -202, -2]) {
    let calls = 0;
    const error = Object.assign(new Error("Network failure"), { errno });
    const contents = {
      isDestroyed: () => false,
      loadURL: async () => {
        calls++;
        assert.equal(canRecoverQuicFailure(contents, errno), false);
        throw error;
      },
    };
    await assert.rejects(loadWebsite(contents, url), error);
    assert.equal(calls, 1);
    assert.equal(canRecoverQuicFailure(contents, -356), false);
  }
});

test("destroyed contents do not receive a second navigation", async () => {
  let calls = 0;
  const contents = {
    isDestroyed: () => true,
    loadURL: async () => {
      calls++;
      throw quicError;
    },
  };
  await assert.rejects(loadWebsite(contents, url), quicError);
  assert.equal(calls, 1);
});

test("an old failure cannot retry over a newer navigation", async () => {
  let rejectOld: (error: Error) => void = () => {};
  const calls: string[] = [];
  const contents = {
    isDestroyed: () => false,
    loadURL: (address: string) => {
      calls.push(address);
      if (address === url)
        return new Promise<void>((_resolve, reject) => {
          rejectOld = reject;
        });
      return Promise.resolve();
    },
  };
  const old = loadWebsite(contents, url);
  const rejected = assert.rejects(old, quicError);
  await loadWebsite(contents, "https://www.youtube.com/");
  rejectOld(quicError);
  await rejected;
  assert.deepEqual(calls, [url, "https://www.youtube.com/"]);
});
