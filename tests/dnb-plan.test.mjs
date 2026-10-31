import test from 'node:test';
import assert from 'node:assert/strict';
import { createDnbPlan, validateDnbPlan, DNB_STYLES } from '../src/dnb/composition-plan.mjs';
test('plans are deterministic and structurally valid for all DnB styles', () => {
  for (const style of Object.keys(DNB_STYLES)) {
    for (let i = 0; i < 100; i++) {
      const args = { seed: 'test-' + i, style };
      const plan = createDnbPlan(args);
      assert.deepEqual(plan, createDnbPlan(args));
      assert.deepEqual(validateDnbPlan(plan), []);
      assert.ok(plan.totalBars >= 128);
    }
  }
});
test('styles vary and invalid styles fail', () => {
  assert.notDeepEqual(createDnbPlan({style:'liquid'}), createDnbPlan({style:'deep'}));
  assert.throws(() => createDnbPlan({style:'rock'}), RangeError);
});
test('validation catches broken phrase boundaries', () => {
  const plan = createDnbPlan();
  plan.sections[0].bars = 7;
  assert.ok(validateDnbPlan(plan).length > 0);
});
