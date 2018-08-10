/*
Handy libs
https://www.npmjs.com/package/stats-lite
https://www.npmjs.com/package/time-span
https://www.npmjs.com/package/benchmark
*/
import stream from 'getstream'
import { FeedManager, FayeFirehose } from '../src/index.js'
import Redis from 'ioredis'
import mongoose from 'mongoose'
import stats from 'stats-lite'
import http from 'http'
import faye from 'faye'
const FAYE_URL = 'http://localhost:8000/faye'

// setup faye
var server = http.createServer(),
	bayeux = new faye.NodeAdapter({ mount: '/faye', timeout: 5 })

const fayeFirehose = new FayeFirehose(FAYE_URL)

let fm = null

export function startFaye() {
	console.log('FAYE_URL', FAYE_URL)
	bayeux.attach(server)
	server.listen(8000)
}

export function getFeedManager() {
	if (fm === null) {
		const redis = new Redis('redis://localhost:6379/9')
		const mongo = mongoose.connect(
			'mongodb://localhost:27017/benchmark',
			{
				autoIndex: true,
				reconnectTries: Number.MAX_VALUE,
				reconnectInterval: 500,
				poolSize: 50,
				bufferMaxEntries: 0,
				keepAlive: 120,
			},
		)

		fm = new FeedManager(mongo, redis, { firehose: fayeFirehose, bull: false })
	}

	return fm
}

export async function runBenchmark(callable, repetitions = 1, concurrency = 1) {
	let n = 0
	for (let i = 0; i < repetitions; i++) {
		let promises = []
		for (let i = 0; i < concurrency; i++) {
			promises.push(callable(n))
			n += 1
		}
		await Promise.all(promises)
	}
}

export function getStreamClient() {
	let client = stream.connect(
		process.env.API_KEY,
		process.env.API_SECRET,
		process.env.APP_ID,
	)
	return client
}

export class Timer {
	constructor(name) {
		this.metrics = {}
		this.current = {}

		if (name) {
			this.start(name)
		}
	}

	start(name, id) {
		const key = `${name}-${id}`
		this.current[key] = new Date()
	}
	stop(name, id) {
		const key = `${name}-${id}`
		const end = new Date()
		const start = this.current[key]
		const duration = end - start
		this.duration(name, duration, start, end)
	}
	duration(name, duration, start, end) {
		if (!(name in this.metrics)) {
			this.metrics[name] = []
		}
		this.metrics[name].push({ name, duration, start, end })
	}
	summarize() {
		for (const [k, v] of Object.entries(this.metrics)) {
			console.log(`====== Metric ${k} ======`)
			let durations = []
			for (const m of v) {
				//console.log(`${m.duration} milliseconds`)
				durations.push(m.duration)
			}
			console.log(`N ${durations.length}`)
			console.log(`mean ${stats.mean(durations)} milliseconds`)
			console.log(`median ${stats.median(durations)} milliseconds`)
		}
	}
}
