import test from 'node:test';
import assert from 'node:assert';
import { memberCardStatus } from './member-status';

const santa = (status: string) => ({ status, isWhiteElephant: false });

test('Member card - before the draw an enrolled agent has joined, whatever the shipping default', () => {
  for (const status of ['SETUP', 'RECRUITING', 'CANCELLED']) {
    assert.strictEqual(memberCardStatus(santa(status), { shippingStatus: 'PENDING' }), 'JOINED', status);
    assert.strictEqual(memberCardStatus(santa(status), {}), 'JOINED', status);
  }
});

test('Member card - after the draw a Secret Santa card shows shipping', () => {
  for (const status of ['MATCHED', 'SHIPPED', 'EXECUTED', 'COMPLETED']) {
    assert.strictEqual(memberCardStatus(santa(status), { shippingStatus: 'PENDING' }), 'AWAITING_SHIPMENT', status);
    assert.strictEqual(memberCardStatus(santa(status), { shippingStatus: 'SHIPPED' }), 'SHIPPED', status);
    assert.strictEqual(memberCardStatus(santa(status), { shippingStatus: 'LOCAL_DELIVERY' }), 'HAND_DELIVERY', status);
  }
});

test('Member card - White Elephant agents never show shipping', () => {
  assert.strictEqual(memberCardStatus({ status: 'MATCHED', isWhiteElephant: true }, { shippingStatus: 'PENDING' }), 'JOINED');
  assert.strictEqual(memberCardStatus({ status: 'COMPLETED', isWhiteElephant: true }, { shippingStatus: 'PENDING' }), 'JOINED');
});
