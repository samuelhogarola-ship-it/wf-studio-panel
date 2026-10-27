#!/usr/bin/env node
import { generateDirectBloggerPasswordHash } from '../src/lib/blogger/direct-access.mjs'

if (process.stdin.isTTY) {
  console.error('Read the owner-managed password from standard input; it is never stored by this script.')
  process.exitCode = 2
} else {
  let password = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) password += chunk
  password = password.replace(/[\r\n]+$/, '')
  try {
    process.stdout.write(`${await generateDirectBloggerPasswordHash(password)}\n`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unable to hash password')
    process.exitCode = 1
  }
}
