import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAddress, validateName, validatePassword, validateRating } from '../src/lib/validation.js'

test('frontend validation mirrors the assignment boundaries', () => {
  assert.match(validateName('a'.repeat(19)), /at least 20/)
  assert.equal(validateName('a'.repeat(20)), '')
  assert.equal(validateName('a'.repeat(60)), '')
  assert.match(validateName('a'.repeat(61)), /at most 60/)
  assert.equal(validateAddress('a'.repeat(400)), '')
  assert.match(validateAddress('a'.repeat(401)), /at most 400/)
})

test('frontend password and rating rules reject malformed values', () => {
  assert.match(validatePassword('lowercase1'), /uppercase/)
  assert.match(validatePassword('Uppercase1'), /special/)
  assert.equal(validatePassword('ValidPass!'), '')
  assert.match(validateRating(1.5), /whole number/)
  assert.match(validateRating(6), /1 to 5/)
  assert.equal(validateRating(5), '')
})
