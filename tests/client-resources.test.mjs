import test from 'node:test'
import assert from 'node:assert/strict'
import { canReadResource, validateImage } from '../src/lib/resources/policy.mjs'
test('each client can only read their own resources; administrator can read all', () => {
 assert.equal(canReadResource(null,'a'),false)
 assert.equal(canReadResource({role:'client',clientId:'a'},'a'),true)
 assert.equal(canReadResource({role:'client',clientId:'a'},'b'),false)
 assert.equal(canReadResource({role:'admin'},'b'),true)
 assert.equal(canReadResource({role:'unknown',clientId:'a'},'a'),false)
})
test('upload validates size and actual image signature, not just declared type',()=>{
 assert.equal(validateImage(Buffer.from([255,216,255,224]),'image/jpeg'),true)
 assert.equal(validateImage(Buffer.from('<svg onload="alert(1)">'),'image/jpeg'),false)
 assert.equal(validateImage(Buffer.from([255,216,255]),'image/png'),false)
 assert.equal(validateImage(Buffer.alloc(10*1024*1024+1),'image/jpeg'),false)
 assert.equal(validateImage(Buffer.alloc(0),'image/jpeg'),false)
})
