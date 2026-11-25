import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./route";

test("monthly chemical cron rejects missing, wrong and query-only credentials", async () => {
  const previous = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "test-monthly-secret";
    for (const request of [
      new Request("http://localhost/api/cron/monthly-chemicals"),
      new Request("http://localhost/api/cron/monthly-chemicals", { headers: { authorization: "Bearer wrong" } }),
      new Request("http://localhost/api/cron/monthly-chemicals?secret=test-monthly-secret"),
    ]) assert.equal((await GET(request)).status, 401);
    delete process.env.CRON_SECRET;
    assert.equal((await GET(new Request("http://localhost/api/cron/monthly-chemicals", { headers: { authorization: "Bearer test-monthly-secret" } }))).status, 401);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("deployment does not send a retroactive October report before December activation", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-25T12:00:00Z") });
  const previous = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "test-monthly-secret";
    const response = await GET(new Request("http://localhost/api/cron/monthly-chemicals", { headers: { authorization: "Bearer test-monthly-secret" } }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(await response.json(), { skipped: true, firstRunMonth: "2026-12", sent: 0, failed: 0 });
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
