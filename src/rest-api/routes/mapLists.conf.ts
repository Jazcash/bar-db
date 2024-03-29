import { FastifyPluginCallback } from "fastify";
import { PluginOptions } from "~/rest-api";
import { GoogleSpreadsheet } from "google-spreadsheet";

const plugin: FastifyPluginCallback<PluginOptions> = async function(app, { config, db, redis }) {
    app.route({
        method: "GET",
        url: "/mapLists.conf",
        handler: async (request, reply) => {
            const mapListsGenerator = new MapListsGenerator({
                googleSheetsId: config.maplists.googleSheetsId,
                googleSheetsAPIKey: config.maplists.googleSheetsAPIKey
            });

            reply.header("Content-Disposition", "inline; filename=mapLists.conf");

            const mapLists = await mapListsGenerator.generate();

            return mapLists.mapListsStr;
        },
    });
};

export interface MapListsGeneratorConfig {
    googleSheetsId: string;
    googleSheetsAPIKey: string;
}

export interface MapPools {
    [key: string]: any;
    certified: string[];
    uncertified: string[];
    small: string[];
    medium: string[];
    large: string[];
    extraLarge: string[];
    misc: string[];
}

export interface ExpectedMapType {
    [key: string]: any;
    fileName: string;
    name: string;
    width: number;
    height: number;
    certified: 1 | "nil";
    inPool: 1;
}

export class MapListsGenerator {
    protected config: MapListsGeneratorConfig;
    protected doc: GoogleSpreadsheet;

    constructor(config: MapListsGeneratorConfig) {
        this.config = config;

        this.doc = new GoogleSpreadsheet(this.config.googleSheetsId);
    }

    public async generate(): Promise<{ mapPools: MapPools, mapListsStr: string; }> {
        this.doc.useApiKey(this.config.googleSheetsAPIKey);
        await this.doc.loadInfo();
        const sheet = this.doc.sheetsByIndex[0];
        await sheet.loadCells();

        const rawHeadingColIndexes: { [key: string]: number } = {};
        for (let x = 2; x < sheet.columnCount; x++) {
            const cellVal = sheet.getCell(2, x).value;
            if (cellVal) {
                rawHeadingColIndexes[cellVal.toString()] = x;
            }
        }

        const lists = [
            "1v1","2v2","3v3","4v4","5v5","6v6","7v7","8v8",
            "ffa3","ffa4","ffa5","ffa6","ffa7","ffa8","ffa9","ffa10","ffa11","ffa12","ffa13","ffa14","ffa15","ffa16",
            "2v2v2","2v2v2v2","2v2v2v2v2","2v2v2v2v2v2","2v2v2v2v2v2v2","2v2v2v2v2v2v2v2","3v3v3","3v3v3v3","3v3v3v3v3","4v4v4","4v4v4v4","5v5v5"
        ];

        const headingColIndex: { [key: string]: number } = {
            fileName: 2,
            name: 3,
            width: rawHeadingColIndexes["sizeX"],
            height: rawHeadingColIndexes["sizeY"],
            certified: rawHeadingColIndexes["Certified?"],
            inPool: rawHeadingColIndexes["Is in pool"],
            playerCount: rawHeadingColIndexes["Player Count"],
            teamCount: rawHeadingColIndexes["Team Count"]
        }

        const mapPools: MapPools = {
            certified: [],
            uncertified: [],
            small: [],
            medium: [],
            large: [],
            extraLarge: [],
            misc: []
        };

        for (const list of lists) {
            headingColIndex[list] = rawHeadingColIndexes[list];
            mapPools[list] = [];
        }

        for (let y = 3; y < sheet.rowCount; y++) {
            const map: ExpectedMapType = {} as any;
            Object.entries(headingColIndex).forEach(([key, dataIndex]) => {
                map[key] = sheet.getCell(y, dataIndex).value;
            });

            if (map.inPool != 1) {
                if (map.name != null) {
                    mapPools.misc.push(map.name);
                }
                continue;
            }

            if (map.certified == 1) {
                mapPools.certified.push(map.name);
            } else {
                mapPools.uncertified.push(map.name);
            }

            const totalSize = map.width + map.height;
            if (totalSize <= 24) {
                mapPools.small.push(map.name);
            } else if (totalSize <= 34) {
                mapPools.medium.push(map.name);
            } else if (totalSize <= 44) {
                mapPools.large.push(map.name);
            } else {
                mapPools.extraLarge.push(map.name);
            }

            let addedToPresetPool = false;

            for (const list of lists) {
                if (map[list]) {
                    mapPools[list].push(map.name);
                    addedToPresetPool = true;
                }
            }

            if (!addedToPresetPool) {
                mapPools.misc.push(map.name);
            }
        }
        return {
            mapPools: mapPools,
            mapListsStr: this.getMapListsConf(mapPools)
        };
    }

    protected getMapListsConf(mapPools: MapPools) : string {
        const header = `# This file was automatically generated by bar-maplists-generator using data from https://docs.google.com/spreadsheets/d/1rn4kIIc9Nnyv_ZiBxXvNXdhUSnh15aLrLsQXmtUBJt8/edit#gid=0
[all]
.*
`;

        let pools = "";
        Object.entries(mapPools).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                pools += `\n[${key}]\n`;
                val.forEach(map => {
                    pools += `${map}\n`;
                });
            } else {
                Object.entries(val).forEach(([playerCount, val2]) => {
                    if (Array.isArray(val2)) {
                        let betterKey = key;
                        pools += `\n[${key}${playerCount}]\n`;
                        val2.forEach(map => {
                            pools += `${map}\n`;
                        });
                    }
                });
            }
        });

        return `${header}${pools}`;
    }
}

export default plugin;