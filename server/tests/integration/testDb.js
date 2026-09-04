'use strict'

// Shared in-memory MongoDB helper for integration tests.
//
// NOTE: mongodb-memory-server downloads a real `mongod` binary on first use.
// In the sandboxed environment this project was originally built in,
// outbound access to fastdl.mongodb.org is blocked by network policy, so
// these integration tests could not be executed there — only the pure-logic
// suites under tests/unit/ were run. They're written to run normally in any
// environment with open internet access (a real dev machine, GitHub
// Actions, etc.) — run `npm test` there to exercise them.

const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

let mongod

async function connect() {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
}

async function clearDatabase() {
  const collections = mongoose.connection.collections
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})))
}

async function disconnect() {
  await mongoose.connection.dropDatabase()
  await mongoose.connection.close()
  if (mongod) await mongod.stop()
}

module.exports = { connect, clearDatabase, disconnect }
