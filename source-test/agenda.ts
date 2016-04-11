// TODO (maybe refactor async tests)
// the original author used setTimeout for the tests to handle asynchronous code.
// Some tests may fail randomly due to removing that without fully refactoring. I didn't
// feel like rewriting all the tests to properly deal with asynchronous code. These are
// here mainly for the sake of type-checking, not for functionality testing.

let mongoHost = process.env.MONGODB_HOST || 'localhost';
let mongoPort = process.env.MONGODB_PORT || '27017';
let mongoCfg = 'mongodb://' + mongoHost + ':' + mongoPort + '/agenda-test';

import { MongoClient, Db, Collection } from "mongodb";
import * as AgendaCore from "agenda";
import { Job as AgendaJob } from "agenda";

var Job = require("../node_modules/agenda/lib/job");
var expect = require("expect.js");
var moment = require("moment-timezone");

interface expect {
    to: expect;
    be(x: any): expect;
    have: expect;
    length(x: any): expect;
    a(x: any): expect;
    an(x: any): expect;
    eql(x: any): expect;
    below(x: any): expect;
    contain(x: any): expect;
}

interface Dictionary<T> {
    [key: string]: T
}

class Agenda extends AgendaCore {
    /**
     * Extend with privates for testing
     */
    _name: string;
    _processEvery: number;
    _defaultConcurrency: number;
    _maxConcurrency: number;
    _defaultLockLimit: number;
    _lockLimit: number;
    _runningJobs: AgendaJob[];
    _lockedJobs: AgendaJob[];
    _jobQueue: AgendaJob[];
    _defaultLockLifetime: number;
    _mdb: Db;
    _collection: Collection;
    _definitions: Dictionary<any>;
}


let jobTimeout = 300;
let mongo: Db = null;

// create agenda instances
let jobs: Agenda = null;

let clearJobs = (done) => {
    mongo.collection('agendaJobs').deleteMany({}, done);
};

let jobType = 'do work';
let noop = () => {};

describe("agenda", () => {

    beforeEach((done) => {
        jobs = new Agenda({
            db: {
                address: mongoCfg
            }
        }, () => {

            MongoClient.connect(mongoCfg, (error, db) => {
                mongo = db;

                clearJobs(() => {
                    jobs.define('someJob', noop);
                    jobs.define('send email', noop);
                    jobs.define('some job', noop);
                    jobs.define(jobType, noop);
                    done();
                });
            });

        });
    });

    afterEach((done) => {
        clearJobs(() => {
            mongo.close(() => {
                jobs.stop();
                jobs._mdb.close(done);
                jobs = null;
            });
        });
    });

    describe('Agenda', () => {
        it('sets a default processEvery', () => {
            expect(jobs._processEvery).to.be(5000);
        });

        describe('configuration methods', () => {
            it('sets the _db directly when passed as an option', () => {
                let agenda = new Agenda({ mongo: mongo });
                expect(agenda._mdb.databaseName).to.equal('agenda-test');
            });
        });

        describe('configuration methods', () => {

            describe('mongo', () => {
                it('sets the _db directly', () => {
                    let agenda = new Agenda();
                    agenda.mongo(mongo);
                    expect(agenda._mdb.databaseName).to.equal('agenda-test');
                });

                it('returns itself', () => {
                    let agenda = new Agenda();
                    expect(agenda.mongo(mongo)).to.be(agenda);
                });
            });

            describe('name', () => {
                it('sets the agenda name', () => {
                    jobs.name('test queue');
                    expect(jobs._name).to.be('test queue');
                });
                it('returns itself', () => {
                    expect(jobs.name('test queue')).to.be(jobs);
                });
            });

            describe('processEvery', () => {
                it('sets the processEvery time', () => {
                    jobs.processEvery('3 minutes');
                    expect(jobs._processEvery).to.be(180000);
                });
                it('returns itself', () => {
                    expect(jobs.processEvery('3 minutes')).to.be(jobs);
                });
            });
            describe('maxConcurrency', () => {
                it('sets the maxConcurrency', () => {
                    jobs.maxConcurrency(10);
                    expect(jobs._maxConcurrency).to.be(10);
                });
                it('returns itself', () => {
                    expect(jobs.maxConcurrency(10)).to.be(jobs);
                });
            });
            describe('defaultConcurrency', () => {
                it('sets the defaultConcurrency', () => {
                    jobs.defaultConcurrency(1);
                    expect(jobs._defaultConcurrency).to.be(1);
                });
                it('returns itself', () => {
                    expect(jobs.defaultConcurrency(5)).to.be(jobs);
                });
            });
            describe('lockLimit', () => {
                it('sets the lockLimit', () => {
                    jobs.lockLimit(10);
                    expect(jobs._lockLimit).to.be(10);
                });
                it('returns itself', () => {
                    expect(jobs.lockLimit(10)).to.be(jobs);
                });
            });
            describe('defaultLockLimit', () => {
                it('sets the defaultLockLimit', () => {
                    jobs.defaultLockLimit(1);
                    expect(jobs._defaultLockLimit).to.be(1);
                });
                it('returns itself', () => {
                    expect(jobs.defaultLockLimit(5)).to.be(jobs);
                });
            });
            describe('defaultLockLifetime', () => {
                it('returns itself', () => {
                    expect(jobs.defaultLockLifetime(1000)).to.be(jobs);
                });
                it('sets the default lock lifetime', () => {
                    jobs.defaultLockLifetime(9999);
                    expect(jobs._defaultLockLifetime).to.be(9999);
                });
                it('is inherited by jobs', () => {
                    jobs.defaultLockLifetime(7777);
                    jobs.define('testDefaultLockLifetime', () => {});
                    expect(jobs._definitions["testDefaultLockLifetime"].lockLifetime).to.be(7777);
                });
            });
        });

        describe('job methods', () => {

            describe('create', () => {
                let job: AgendaJob;
                beforeEach(() => {
                    job = jobs.create('sendEmail', { to: 'some guy' });
                });

                it('returns a job', () => {
                    expect(job).to.be.a(Job);
                });
                it('sets the name', () => {
                    expect(job.attrs.name).to.be('sendEmail');
                });
                it('sets the type', () => {
                    expect(job.attrs.type).to.be('normal');
                });
                it('sets the agenda', () => {
                    expect(job.agenda).to.be(jobs);
                });
                it('sets the data', () => {
                    expect(job.attrs.data).to.have.property('to', 'some guy');
                });
            });

            describe('define', () => {

                it('stores the definition for the job', () => {
                    expect(jobs._definitions["someJob"]).to.have.property('fn', noop);
                });

                it('sets the default concurrency for the job', () => {
                    expect(jobs._definitions["someJob"]).to.have.property('concurrency', 5);
                });

                it('sets the default lockLimit for the job', () => {
                    expect(jobs._definitions["someJob"]).to.have.property('lockLimit', 0);
                });

                it('sets the default priority for the job', () => {
                    expect(jobs._definitions["someJob"]).to.have.property('priority', 0);
                });
                it('takes concurrency option for the job', () => {
                    jobs.define('highPriority', { priority: 10 }, noop);
                    expect(jobs._definitions["highPriority"]).to.have.property('priority', 10);
                });
            });

            describe('every', () => {
                describe('with a job name specified', () => {
                    it('returns a job', () => {
                        expect(jobs.every('5 minutes', 'send email')).to.be.a(Job);
                    });
                    it('sets the repeatEvery', () => {
                        expect(jobs.every('5 seconds', 'send email').attrs.repeatInterval).to.be('5 seconds');
                    });
                    it('sets the agenda', () => {
                        expect(jobs.every('5 seconds', 'send email').agenda).to.be(jobs);
                    });
                    it('should update a job that was previously scheduled with `every`', (done) => {
                        jobs.every(10, 'shouldBeSingleJob');
                        setTimeout(() => {
                            jobs.every(20, 'shouldBeSingleJob');
                        }, 10);

                        // Give the saves a little time to propagate
                        setTimeout(() => {
                            jobs.jobs({ name: 'shouldBeSingleJob' }, (err, res) => {
                                expect(res).to.have.length(1);
                                done();
                            });
                        }, jobTimeout);

                    });
                });
                describe('with array of names specified', () => {
                    it('returns array of jobs', () => {
                        expect(jobs.every('5 minutes', ['send email', 'some job'])).to.be.an('array');
                    });
                });
            });

            describe('schedule', () => {
                describe('with a job name specified', () => {
                    it('returns a job', () => {
                        expect(jobs.schedule('in 5 minutes', 'send email')).to.be.a(Job);
                    });
                    it('sets the schedule', () => {
                        let fiveish = (new Date()).valueOf() + 250000;
                        expect(jobs.schedule('in 5 minutes', 'send email').attrs.nextRunAt.valueOf()).to.be.greaterThan(fiveish);
                    });
                });
                describe('with array of names specified', () => {
                    it('returns array of jobs', () => {
                        expect(jobs.schedule('5 minutes', ['send email', 'some job'])).to.be.an('array');
                    });
                });
            });

            describe('unique', () => {

                describe('should demonstrate unique contraint', () => {

                    it('should modify one job when unique matches', (done) => {
                        jobs.create('unique job', {
                            type: 'active',
                            userId: '123',
                            'other': true
                        }).unique({
                            'data.type': 'active',
                            'data.userId': '123'
                        }).schedule("now").save((err, job1) => {
                            setTimeout(() => { // Avoid timing condition where nextRunAt coincidentally is the same
                                jobs.create('unique job', {
                                    type: 'active',
                                    userId: '123',
                                    'other': false
                                }).unique({
                                    'data.type': 'active',
                                    'data.userId': '123'
                                }).schedule("now").save((err, job2) => {
                                    expect(job1.attrs.nextRunAt.toISOString()).not.to.equal(job2.attrs.nextRunAt.toISOString());
                                    mongo.collection('agendaJobs').find({ name: 'unique job' }).toArray((err, j) => {
                                        expect(j).to.have.length(1);
                                        done();
                                    });
                                });
                            }, 1);
                        });
                    });

                    it('should not modify job when unique matches and insertOnly is set to true', (done) => {
                        jobs.create('unique job', {
                            type: 'active',
                            userId: '123',
                            'other': true
                        }).unique({
                            'data.type': 'active',
                            'data.userId': '123'
                        }, { insertOnly: true }).schedule("now").save((err, job1) => {
                            jobs.create('unique job', {
                                type: 'active',
                                userId: '123',
                                'other': false
                            }).unique({
                                'data.type': 'active',
                                'data.userId': '123'
                            }, { insertOnly: true }).schedule("now").save((err, job2) => {
                                expect(job1.attrs.nextRunAt.toISOString()).to.equal(job2.attrs.nextRunAt.toISOString());
                                mongo.collection('agendaJobs').find({ name: 'unique job' }).toArray((err, j) => {
                                    expect(j).to.have.length(1);
                                    done();
                                });
                            });
                        });
                    });
                });

                describe('should demonstrate non-unique contraint', () => {

                    it('should create two jobs when unique doesn\t match', (done) => {
                        let time = new Date(Date.now() + 1000 * 60 * 3);
                        let time2 = new Date(Date.now() + 1000 * 60 * 4);

                        jobs.create('unique job', {
                            type: 'active',
                            userId: '123',
                            'other': true
                        }).unique({
                            'data.type': 'active',
                            'data.userId': '123',
                            nextRunAt: time
                        }).schedule(time).save(() => {


                            jobs.create('unique job', {
                                type: 'active',
                                userId: '123',
                                'other': false
                            }).unique({
                                'data.type': 'active',
                                'data.userId': '123',
                                nextRunAt: time2
                            }).schedule(time).save(() => {

                                mongo.collection('agendaJobs').find({ name: 'unique job' }).toArray((err, j) => {
                                    expect(j).to.have.length(2);
                                    done();
                                });
                            });
                        });

                    });
                });

            });

            describe('now', () => {
                it('returns a job', () => {
                    expect(jobs.now('send email')).to.be.a(Job);
                });
                it('sets the schedule', () => {
                    let now = new Date();
                    expect(jobs.now('send email').attrs.nextRunAt.valueOf()).to.be.greaterThan(now.valueOf() - 1);
                });

                it('runs the job immediately', (done) => {
                    jobs.define('immediateJob', (job) => {
                        expect(job.isRunning()).to.be(true);
                        jobs.stop(done);
                    });
                    jobs.now('immediateJob');
                    jobs.start();
                });
            });

            describe('jobs', () => {
                it('returns jobs', (done) => {
                    let job = jobs.create('test');
                    job.save(() => {
                        jobs.jobs({}, (err, c) => {
                            expect(c.length).to.not.be(0);
                            expect(c[0]).to.be.a(Job);
                            clearJobs(done);
                        });
                    });
                });
            });

            describe('purge', () => {
                it('removes all jobs without definitions', (done) => {
                    let job = jobs.create('no definition');
                    jobs.stop(() => {
                        job.save(() => {
                            jobs.jobs({ name: 'no definition' }, (err, j) =>  {
                                if (err) {
                                    return done(err);
                                }
                                expect(j).to.have.length(1);
                                jobs.purge((err) =>  {
                                    if (err) {
                                        return done(err);
                                    }
                                    jobs.jobs({ name: 'no definition' }, (err, j) =>  {
                                        if (err) {
                                            return done(err);
                                        }
                                        expect(j).to.have.length(0);
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
            });

            describe('saveJob', () => {
                it('persists job to the database', (done) => {
                    let job = jobs.create('someJob', {});
                    job.save((err, job) =>  {
                        expect(job.attrs._id).to.be.ok();
                        clearJobs(done);
                    });
                });
            });
        });

        describe('cancel', () => {
            beforeEach((done) => {
                let remaining = 3;
                let checkDone = (err) =>  {
                    if (err) {
                        return done(err);
                    }
                    remaining--;
                    if (!remaining) {
                        done();
                    }
                };
                jobs.create('jobA').save(checkDone);
                jobs.create('jobA', 'someData').save(checkDone);
                jobs.create('jobB').save(checkDone);
            });

            afterEach((done) => {
                jobs._collection.deleteMany({ name: { $in: ['jobA', 'jobB'] } }, (err) =>  {
                    if (err) {
                        return done(err);
                    }
                    done();
                });
            });

            it('should cancel a job', (done) => {
                jobs.jobs({ name: 'jobA' }, (err, j) =>  {
                    if (err) {
                        return done(err);
                    }
                    expect(j).to.have.length(2);
                    jobs.cancel({ name: 'jobA' }, (err) =>  {
                        if (err) {
                            return done(err);
                        }
                        jobs.jobs({ name: 'jobA' }, (err, j) =>  {
                            if (err) {
                                return done(err);
                            }
                            expect(j).to.have.length(0);
                            done();
                        });
                    });
                });
            });

            it('should cancel multiple jobs', (done) => {
                jobs.jobs({ name: { $in: ['jobA', 'jobB'] } }, (err, j) =>  {
                    if (err) {
                        return done(err);
                    }
                    expect(j).to.have.length(3);
                    jobs.cancel({ name: { $in: ['jobA', 'jobB'] } }, (err) =>  {
                        if (err) {
                            return done(err);
                        }
                        jobs.jobs({ name: { $in: ['jobA', 'jobB'] } }, (err, j) =>  {
                            if (err) {
                                return done(err);
                            }
                            expect(j).to.have.length(0);
                            done();
                        });
                    });
                });
            });

            it('should cancel jobs only if the data matches', (done) => {
                jobs.jobs({ name: 'jobA', data: 'someData' }, (err, j) =>  {
                    if (err) {
                        return done(err);
                    }
                    expect(j).to.have.length(1);
                    jobs.cancel({ name: 'jobA', data: 'someData' }, (err) =>  {
                        if (err) {
                            return done(err);
                        }
                        jobs.jobs({ name: 'jobA', data: 'someData' }, (err, j) =>  {
                            if (err) {
                                return done(err);
                            }
                            expect(j).to.have.length(0);
                            jobs.jobs({ name: 'jobA' }, (err, j) =>  {
                                if (err) {
                                    return done(err);
                                }
                                expect(j).to.have.length(1);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    describe('Job', () => {

        describe('repeatAt', () => {

            let job: AgendaJob;
            beforeEach(() => {
                job = jobs.create("repeatAt");
            });

            it('sets the repeat at', () => {
                job.repeatAt('3:30pm');
                expect(job.attrs.repeatAt).to.be('3:30pm');
            });
            it('returns the job', () => {
                expect(job.repeatAt('3:30pm')).to.be(job);
            });
        });

        describe('unique', () => {

            let job: AgendaJob;
            beforeEach(() => {
                job = jobs.create("unique");
            });

            it('sets the unique property', () => {
                job.unique({ 'data.type': 'active', 'data.userId': '123' });
                expect(JSON.stringify(job.attrs.unique)).to.be(JSON.stringify({
                    'data.type': 'active',
                    'data.userId': '123'
                }));
            });
            it('returns the job', () => {
                expect(job.unique({ 'data.type': 'active', 'data.userId': '123' })).to.be(job);
            });
        });

        describe('repeatEvery', () => {

            let job: AgendaJob;
            beforeEach(() => {
                job = jobs.create("repeatEvery");
            });

            it('sets the repeat interval', () => {
                job.repeatEvery(5000);
                expect(job.attrs.repeatInterval).to.be(5000);
            });
            it('returns the job', () => {
                expect(job.repeatEvery('one second')).to.be(job);
            });
        });

        describe('schedule', () => {
            let job: AgendaJob;
            beforeEach(() => {
                job = jobs.create("schedule");
            });
            it('sets the next run time', () => {
                job.schedule('in 5 minutes');
                expect(job.attrs.nextRunAt).to.be.a(Date);
            });
            it('sets the next run time Date object', () => {
                let when = new Date(Date.now() + 1000 * 60 * 3);
                job.schedule(when);
                expect(job.attrs.nextRunAt).to.be.a(Date);
                expect(job.attrs.nextRunAt.getTime()).to.eql(when.getTime());
            });
            it('returns the job', () => {
                expect(job.schedule('tomorrow at noon')).to.be(job);
            });
        });

        describe('priority', () => {
            let job: AgendaJob;
            beforeEach(() => {
                job = jobs.create("priority");
            });
            it('sets the priority to a number', () => {
                job.priority(10);
                expect(job.attrs.priority).to.be(10);
            });
            it('returns the job', () => {
                expect(job.priority(50)).to.be(job);
            });
            it('parses written priorities', () => {
                job.priority('high');
                expect(job.attrs.priority).to.be(10);
            });
        });

        describe('computeNextRunAt', () => {

            let job: AgendaJob;

            beforeEach(() => {
                job = jobs.create("computeNextRunAt");
            });

            it('returns the job', () => {
                expect(job.computeNextRunAt()).to.be(job);
            });

            it('sets to undefined if no repeat at', () => {
                job.attrs.repeatAt = null;
                job.computeNextRunAt();
                expect(job.attrs.nextRunAt).to.be(undefined);
            });

            it('it understands repeatAt times', () => {
                let d = new Date();
                d.setHours(23);
                d.setMinutes(59);
                d.setSeconds(0);
                job.attrs.repeatAt = '11:59pm';
                job.computeNextRunAt();
                expect(job.attrs.nextRunAt.getHours()).to.be(d.getHours());
                expect(job.attrs.nextRunAt.getMinutes()).to.be(d.getMinutes());
            });

            it('sets to undefined if no repeat interval', () => {
                job.attrs.repeatInterval = null;
                job.computeNextRunAt();
                expect(job.attrs.nextRunAt).to.be(undefined);
            });

            it('it understands human intervals', () => {
                let now = new Date();
                job.attrs.lastRunAt = now;
                job.repeatEvery('2 minutes');
                job.computeNextRunAt();
                expect(job.attrs.nextRunAt).to.be(now.valueOf() + 120000);
            });

            it('understands cron intervals', () => {
                let now = new Date();
                now.setMinutes(1);
                now.setMilliseconds(0);
                now.setSeconds(0);
                job.attrs.lastRunAt = now;
                job.repeatEvery('*/2 * * * *');
                job.computeNextRunAt();
                expect(job.attrs.nextRunAt.valueOf()).to.be(now.valueOf() + 60000);
            });

            it('understands cron intervals with a timezone', () => {

                job.attrs.lastRunAt = new Date('2015-01-01T06:01:00-00:00');
                job.repeatEvery('0 6 * * *', {
                    timezone: 'GMT'
                });
                job.computeNextRunAt();
                expect(moment(job.attrs.nextRunAt).tz('GMT').hour()).to.be(6);
                expect(moment(job.attrs.nextRunAt).toDate().getDate()).to.be(moment(job.attrs.lastRunAt).add(1, 'days').toDate().getDate());
            });

            it('understands cron intervals with a timezone when last run is the same as the interval', () => {
                job.attrs.lastRunAt = new Date('2015-01-01T06:00:00-00:00');
                job.repeatEvery('0 6 * * *', {
                    timezone: 'GMT'
                });
                job.computeNextRunAt();
                expect(moment(job.attrs.nextRunAt).tz('GMT').hour()).to.be(6);
                expect(moment(job.attrs.nextRunAt).toDate().getDate()).to.be(moment(job.attrs.lastRunAt).add(1, 'days').toDate().getDate());
            });

            describe('when repeat at time is invalid', () => {
                beforeEach((done) => {
                    try {
                        job.attrs.repeatAt = 'foo';
                        job.computeNextRunAt();
                        return done();
                    }
                    catch (e) { return done(e) }
                });

                it('sets nextRunAt to undefined', () => {
                    expect(job.attrs.nextRunAt).to.be(undefined);
                });

                it('fails the job', () => {
                    expect(job.attrs.failReason).to.equal('failed to calculate repeatAt time due to invalid format');
                });
            });

            describe('when repeat interval is invalid', () => {
                beforeEach(() => {
                    try {
                        job.attrs.repeatInterval = 'asd';
                        job.computeNextRunAt();
                    }
                    catch (e) {}
                });

                it('sets nextRunAt to undefined', () => {
                    expect(job.attrs.nextRunAt).to.be(undefined);
                });

                it('fails the job', () => {
                    expect(job.attrs.failReason).to.equal('failed to calculate nextRunAt due to invalid repeat interval');
                });
            });

        });

        describe('remove', () => {
            it('removes the job', (done) => {
                let job = jobs.create("removed job");
                job.save((err) =>  {
                    if (err) {
                        return done(err);
                    }
                    job.remove((err) =>  {
                        if (err) {
                            return done(err);
                        }
                        mongo.collection('agendaJobs').find({ _id: job.attrs._id }).toArray((err, j) =>  {
                            expect(j).to.have.length(0);
                            done();
                        });
                    });
                });
            });
        });

        describe('run', () => {
            let job: AgendaJob;

            beforeEach(() => {
                job = jobs.create("run");
            });

            it('updates lastRunAt', (done) => {
                let now = new Date();
                setTimeout(() => {
                    job.run(() => {
                        expect(job.attrs.lastRunAt.valueOf()).to.be.greaterThan(now.valueOf());
                        done();
                    });
                }, 5);
            });

            it('fails if job is undefined', (done) => {

                job = jobs.create("not defined");
                job.run(() => {
                    expect(job.attrs.failedAt).to.be.ok();
                    expect(job.attrs.failReason).to.be('Undefined job');
                    done();
                });
            });
            it('updates nextRunAt', (done) => {
                let now = new Date();
                job.repeatEvery('10 minutes');
                setTimeout(() => {
                    job.run(() => {
                        expect(job.attrs.nextRunAt.valueOf()).to.be.greaterThan(now.valueOf() + 59999);
                        done();
                    });
                }, 5);
            });
            it('handles errors', (done) => {
                job.attrs.name = 'failBoat';
                jobs.define('failBoat', () => {
                    throw(new Error("Zomg fail"));
                });
                job.run((err) =>  {
                    expect(err).to.be.ok();
                    done();
                });
            });
            it('handles errors with q promises', (done) => {
                job.attrs.name = 'failBoat2';
                jobs.define('failBoat2', (job, cb) =>  {
                    var Q = require('q');
                    Q.delay(100)
                        .then(() => {
                            throw(new Error("Zomg fail"));
                        })
                        .fail(cb)
                        .done();
                });
                job.run((err) =>  {
                    expect(err).to.be.ok();
                    done();
                });
            });

            it('doesn\'t allow a stale job to be saved', (done) => {

                job.attrs.name = 'failBoat3';
                job.save((err) =>  {
                    if (err) {
                        return done(err);
                    }
                    jobs.define('failBoat3', (job, cb) =>  {
                        // Explicitly find the job again,
                        // so we have a new job object
                        jobs.jobs({ name: 'failBoat3' }, (err, j) =>  {
                            if (err) {
                                return done(err);
                            }
                            j[0].remove((err) =>  {
                                if (err) {
                                    return done(err);
                                }
                                cb();
                            });
                        });
                    });

                    job.run(() => {
                        // Expect the deleted job to not exist in the database
                        jobs.jobs({ name: 'failBoat3' }, (err, j) =>  {
                            if (err) {
                                return done(err);
                            }
                            expect(j).to.have.length(0);
                            done();
                        });
                    });
                });
            });

        });

        describe('touch', () => {
            it('extends the lock lifetime', (done) => {
                let lockedAt = new Date();

                jobs
                    .create("touch", { lockedAt: lockedAt })
                    .save((error, job) => {

                        setTimeout(() => {
                            job.touch((err, touchedJob) => {
                                expect(touchedJob.attrs.lockedAt).to.be.greaterThan(lockedAt);
                                done();
                            });
                        }, 10);
                    });
            });
        });


        describe('fail', () => {

            let job: AgendaJob;
            beforeEach(() => {
                job = jobs.create("failTest");
            });

            it('takes a string', () => {
                job.fail('test');
                expect(job.attrs.failReason).to.be('test');
            });
            it('takes an error object', () => {
                job.fail(new Error('test'));
                expect(job.attrs.failReason).to.be('test');
            });
            it('sets the failedAt time', () => {
                job.fail('test');
                expect(job.attrs.failedAt).to.be.a(Date);
            });
        });

        describe('enable', () => {
            it('sets disabled to false on the job', () => {

                let job = jobs.create("enableTest", { disabled: true });
                job.enable();
                expect(job.attrs.disabled).to.be(false);
            });

            it('returns the job', () => {
                let job = jobs.create("enableTest", { disabled: true });
                expect(job.enable()).to.be(job);
            });
        });

        describe('disable', () => {
            it('sets disabled to true on the job', () => {
                let job = jobs.create("disable test");
                job.disable();
                expect(job.attrs.disabled).to.be(true);
            });
            it('returns the job', () => {
                let job = jobs.create("disable test");
                expect(job.disable()).to.be(job);
            });
        });

        describe('save', () => {
            it('calls saveJob on the agenda', (done) => {
                let oldSaveJob = jobs.saveJob;
                jobs.saveJob = () => {
                    jobs.saveJob = oldSaveJob;
                    done();
                };
                let job = jobs.create('some job', { wee: 1 });
                job.save();
            });

            it('doesnt save the job if its been removed', (done) => {
                let job = jobs.create('another job');
                // Save, then remove, then try and save again.
                // The second save should fail.
                job.save((err, j) =>  {
                    j.remove(() => {
                        j.save(() => {
                            jobs.jobs({ name: 'another job' }, (err, res) =>  {
                                expect(res).to.have.length(0);
                                done();
                            });
                        });
                    });
                });
            });

            it('returns the job', () => {
                let job = jobs.create('some job', { wee: 1 });
                expect(job.save()).to.be(job);
            });
        });

        describe("start/stop", () => {
            it("starts/stops the job queue", (done) => {
                jobs.define('jobQueueTest', function jobQueueTest(job, cb) {
                    jobs.stop(() => {
                        clearJobs(() => {
                            cb();
                            jobs.define('jobQueueTest', (job, cb) =>  {
                                cb();
                            });
                            done();
                        });
                    });
                });
                jobs.every('1 second', 'jobQueueTest');
                jobs.processEvery('1 second');
                jobs.start();
            });

            it('does not run disabled jobs', (done) => {
                let ran = false;
                jobs.define('disabledJob', () => {
                    ran = true;
                });
                let job = jobs.create('disabledJob').disable().schedule('now');
                job.save((err) =>  {
                    if (err) {
                        return done(err);
                    }
                    jobs.start();
                    setTimeout(() => {
                        expect(ran).to.be(false);
                        jobs.stop(done);
                    }, jobTimeout);
                });
            });

            it('does not throw an error trying to process undefined jobs', (done) => {
                jobs.start();
                let job = jobs.create('jobDefinedOnAnotherServer').schedule('now');

                job.save((err) =>  {
                    expect(err).to.be(null);
                });

                setTimeout(() => {
                    jobs.stop(done);
                }, jobTimeout);
            });

            it('clears locks on stop', (done) => {
                jobs.define('longRunningJob', () => {
                    //Job never finishes
                });
                jobs.every('10 seconds', 'longRunningJob');
                jobs.processEvery('1 second');
                jobs.start();
                setTimeout(() => {
                    jobs.stop(() => {

                        jobs._collection.find({ name: 'longRunningJob' }).limit(1).next((err, job) =>  {
                            expect(job.lockedAt).to.be(null);
                            done();
                        });
                    });
                }, jobTimeout);
            });

            describe('events', () => {
                beforeEach(() => {
                    jobs.define('jobQueueTest', function jobQueueTest(job, cb) {
                        cb();
                    });
                    jobs.define('failBoat', () => {
                        throw(new Error("Zomg fail"));
                    });
                });

                it('emits start event', (done) => {
                    let job = jobs.create("jobQueueTest");
                    jobs.once('start', function(j) {
                        expect(j).to.be(job);
                        done();
                    });
                    job.run();
                });
                it('emits start:job name event', (done) => {
                    let job = jobs.create("jobQueueTest");
                    jobs.once('start:jobQueueTest', function(j) {
                        expect(j).to.be(job);
                        done();
                    });
                    job.run();
                });
                it('emits complete event', (done) => {
                    let job = jobs.create("jobQueueTest");
                    jobs.once('complete', function(j) {
                        expect(job.attrs._id.toString()).to.be(j.attrs._id.toString());
                        done();
                    });
                    job.run();
                });
                it('emits complete:job name event', (done) => {
                    let job = jobs.create("jobQueueTest");
                    jobs.once('complete:jobQueueTest', function(j) {
                        expect(job.attrs._id.toString()).to.be(j.attrs._id.toString());
                        done();
                    });
                    job.run();
                });
                it('emits success event', (done) => {
                    let job = jobs.create("jobQueueTest");
                    jobs.once('success', function(j) {
                        expect(j).to.be.ok();
                        done();
                    });
                    job.run();
                });
                it('emits success:job name event', (done) => {
                    let job = jobs.create("jobQueueTest");
                    jobs.once('success:jobQueueTest', function(j) {
                        expect(j).to.be.ok();
                        done();
                    });
                    job.run();
                });
                it('emits fail event', (done) => {
                    let job = jobs.create("failBoat");
                    jobs.once('fail', (err, j) =>  {
                        expect(err.message).to.be('Zomg fail');
                        expect(j).to.be(job);
                        expect(j.attrs.failCount).to.be(1);
                        expect(j.attrs.failedAt.valueOf()).not.to.be.below(j.attrs.lastFinishedAt.valueOf());

                        jobs.once('fail', (err, j) =>  {
                            expect(j).to.be(job);
                            expect(j.attrs.failCount).to.be(2);
                            done();
                        });
                        job.run();
                    });
                    job.run();
                });

                it('emits fail:job name event', (done) => {
                    let job = jobs.create("failBoat");
                    jobs.once('fail:failBoat', (err, j) =>  {
                        expect(err.message).to.be('Zomg fail');
                        expect(j).to.be(job);
                        done();
                    });
                    job.run();
                });
            });
        });
    });

    describe('Retry', () => {
        it('should retry a job', (done) => {
            let shouldFail = true;
            jobs.define('a job', (job, done) =>  {
                if (shouldFail) {
                    shouldFail = false;
                    return done(new Error('test failure'));
                }
                done();
            });

            jobs.on('fail:a job', (err, job) =>  {
                job
                    .schedule('now')
                    .save();
            });

            jobs.on('success:a job', () => {
                done();
            });

            jobs.now('a job');

            jobs.start();
        });
    });

});
