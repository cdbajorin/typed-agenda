import { Db, MongoClientOptions, UpdateWriteOpResult, Collection, } from "mongodb";
import { EventEmitter } from "events";
type Job = Agenda.Job;

interface Callback<T> {
    (error?: Error, result?: T): void;
}
interface Dictionary<T> {
    [key: string]: T
}

interface JobProcessor {
    (job: Job, callback?: Callback<any>): void;
}

interface MongoJob {
    _id: any;
    name: string;
    data: any;
    type: string;
    priority: number;
    unique?: string;
    nextRunAt: Date;
    repeatInterval?: string;
    repeatAt?: string;
    lastModifiedBy?: string;
    lockedAt?: Date;
    lastRunAt?: Date;
    lastFinishedAt?: Date;
    failedAt?: Date;
    failReason: string;
    failCount?: number;
    disabled?: boolean;
}

type JobPriority  = "highest"|"high"|"default"|"low"|"lowest";

interface DefineOptions {
    concurrency?: number;
    lockLimit?: number;
    lockLifetime?: number;
    priority?: JobPriority|number;
}

interface BaseConfigOptions {
    name?: string;
    processEvery?: string;
    defaultConcurrency?: number;
    maxConcurrency?: number;
    defaultLockLimit?: number
    lockLimit?: number
    defaultLockLifetime?: number
    address?: string;
}


declare class Agenda extends EventEmitter {
    
    /**
     * Init with database uri
     */
    constructor(config: Agenda.UrlAgendaOptions, callback?: Callback<string>);
    
    database(uri: string, collection?: string, options?: MongoClientOptions, callback?: Callback<string>): Agenda;
    
    /**
     * Init with MongoClient
     */
    constructor(config: Agenda.MongoAgendaOptions, callback?: Callback<Collection>);
    
    mongo(mdb: Db, collection?: string, callback?: Callback<string>): Agenda;
    
    /**
     * configuration chaining
     */
    constructor();
    
    name(name: string): Agenda;
    
    processEvery(time: string|number): Agenda;
    
    maxConcurrency(num: number): Agenda;
    
    defaultConcurrency(num: number): Agenda;
    
    lockLimit(num: number): Agenda;
    
    defaultLockLimit(num: number): Agenda;
    
    defaultLockLifetime(ms: number): Agenda;
    
    /**
     * Creating Jobs
     */
    
    define(name: string, processor?: JobProcessor): void;
    define(name: string, options?: DefineOptions, processor?: JobProcessor): void;
    
    every(interval: string|number, name: string, callback?: Callback<Job>): Job;
    every(interval: string|number, names: string[], callback?: Callback<Job>): Job[];
    every(interval: string|number, name: string, data?: any, callback?: Callback<Job>): Job;
    every(interval: string|number, names: string[], data?: any, callback?: Callback<Job>): Job[];
    every(interval: string|number, name: string, data?: any, options?: {timezone: string}, callback?: Callback<Job>): Job;
    every(interval: string|number, names: string[], data?: any, options?: {timezone: string}, callback?: Callback<Job>): Job[];
    
    schedule(when: string|Date, name: string, callback?: Callback<Job>): Job;
    schedule(when: string|Date, names: string|string[], callback?: Callback<Job>): Job[];
    schedule(when: string|Date, name: string, data?: any, callback?: Callback<Job>): Job;
    schedule(when: string|Date, names: string[], data?: any, callback?: Callback<Job>): Job[];
    
    now(name: string, callback?: Callback<Job>): Job;
    now(name: string, data?: any, callback?: Callback<Job>): Job;
    
    create(name: string, data?: any): Job;
    
    /**
     * Managing Jobs
     */
    
    jobs(query: Object, callback: Callback<Job[]>): void;
    
    cancel(query: Object, callback?: Callback<number>): void;
    
    purge(callback?: Callback<number>)
    
    saveJob(job: Job, callback?: Callback<Job>): void;
    
    start(): void;
    
    stop(callback?: Callback<UpdateWriteOpResult>): void;
}

declare namespace Agenda {
    
    export interface MongoAgendaOptions extends BaseConfigOptions {
        mongo: Db
        db?: string|{ collection: string };
    }
    
    export interface UrlAgendaOptions extends BaseConfigOptions {
        db: {
            address: string;
            collection?: string;
            options?: MongoClientOptions
        }
    }
    
    export interface Job {
        repeatEvery(interval: string|number, options?: {timezone: string}): Job;
        repeatAt(time: string|number): Job;
        schedule(time: string|Date): Job;
        priority(priority: number|JobPriority): Job;
        unique(unique: Dictionary<any>, opts?: { insertOnly: boolean }): Job;
        fail(reason: string|Error): Job
        run(callback?: Callback<Job>): void;
        save(callback?: Callback<Job>): Job;
        remove(callback?: Callback<number>): void;
        touch(callback?: Callback<Job>): void
        isRunning(): boolean;
        computeNextRunAt(): Job;
        toJSON(): MongoJob;
        disable(): Job;
        enable(): Job;
        
        attrs: MongoJob;
        agenda: Agenda;
    }
}
export = Agenda;