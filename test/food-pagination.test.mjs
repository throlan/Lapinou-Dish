import test from 'node:test';
import assert from 'node:assert/strict';
import { clampFoodPageOffset } from '../web/food-pagination.js';

test('food pagination keeps the current page while it still contains results', () => {
  assert.equal(clampFoodPageOffset(127, 50, 50), 50);
});

test('food pagination moves to the last page when deletion empties the current page', () => {
  assert.equal(clampFoodPageOffset(100, 50, 100), 50);
  assert.equal(clampFoodPageOffset(0, 50, 50), 0);
});
