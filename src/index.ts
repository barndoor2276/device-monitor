import fs from 'fs';
import https from 'https';
import { IncomingMessage } from 'http';
import { EOL } from 'os';

class MemoryObject {
    free: number;
    total: number;
    percent: number;
    constructor(free: number, total: number) {
        this.free = free;
        this.total = total;
        if (this.free === null
            || this.free === undefined
            || this.total === null
            || this.total === undefined
            || this.total === 0) {
            this.percent = -1;
        } else {
            this.percent = ((this.free / this.total) * 100);
        }
    }
}

class DeviceMonitor {
    dir: string = './log';
    interval: number = 1000 * 60 * 5;

    constructor() {
        this.init();
    }

    private async init() {
        fs.mkdir(this.dir, { recursive: true }, async (err) => {
            await new Promise(resolve => {
                fs.stat(this.dir + `/mem.csv`, (err, stats) => {
                    if (err) {
                        fs.writeFile(this.dir + `/mem.csv`, `Date,Free,Total,Percent${EOL}`, resolve);
                    } else {
                        resolve();
                    }
                });
            });

            while (true) {
                let response = await this.makeRequest({
                    host: 'mclovin',
                    port: 443,
                    method: 'GET',
                    path: '/system/properties',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Basic YXBpdGVjaDpQYXNzd29yZDE='
                    },
                    rejectUnauthorized: false
                });

                let data: any[] = [];
                response.on('data', (chunk) => {
                    data.push(chunk);
                });

                await new Promise(resolve2 => {
                    response.on('end', () => {
                        let dataString = Buffer.concat(data).toString();
                        try {
                            let dataJSON = JSON.parse(dataString);
                            let memObj: MemoryObject = new MemoryObject(parseInt(dataJSON.system.memory.free), parseInt(dataJSON.system.memory.total));
                            resolve2(memObj);
                        } catch {
                            resolve2(new MemoryObject(null, null));
                        }
                    });
                }).then((memory: MemoryObject) => {
                    let writeData = `${new Date(Date.now()).toISOString()},${memory.free},${memory.total},${memory.percent}${EOL}`;
                    fs.writeFile(this.dir + `/mem.csv`, writeData, { encoding: 'utf8', flag: 'a' }, (err) => { });
                });

                await new Promise(resolve1 => {
                    setTimeout(resolve1, this.interval);
                });
            }
        });
    }

    public makeRequest(opts: https.RequestOptions): Promise<IncomingMessage> {
        return new Promise(resolve => {
            let req = https.request(opts, resolve);

            req.on('error', (reqErr) => {
                fs.mkdir(this.dir, (mkdirErr) => {
                    fs.writeFile(`${this.dir}/err.log`, `${new Date(Date.now()).toISOString()} : ${reqErr}`, (writeFileErr) => { });
                });
            });

            req.end();
        });
    }
}

let dm = new DeviceMonitor();
