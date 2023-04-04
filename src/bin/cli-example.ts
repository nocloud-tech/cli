#!/usr/bin/env node
import * as cli from "../lib"
import { Pool, PoolClient } from "pg"

const ConnectToPg = async() => {
    return new Pool();
}

cli.Run({
    help: [
        `cli-example`,
        `  An example of how to use the CLI library.`,
        ``,
        `Commands`,
        `  help`,
        `    Display this help message.`,
        ``,
        `  pet`,
        `    Echo a random pet name from a hard-coded array`,
        `    of pet names.`,
        ``,
        `  pet-postgres`,
        `    Echo a random pet name from a hard-coded temporary`,
        `    PostgreSQL table (Common Table Expression) of pet`,
        `    names. This tests the parameter creation functionality.`,
    ].join("\n"),
    functions: {
        pet: async() => {
            const names = ["Spot", "Jack", "Max"];
            const index = Math.floor(Math.random() * names.length);
            process.stdout.write(`${names[index]}\n`);
        },
        "pet-postgres": cli.CreateParameterisedCliFunction(ConnectToPg, async(pool:Pool, args:string[]) => {
            let db : PoolClient|undefined;
            try {
                db = await pool.connect();
                const query = [
                    `with`,
                    `p as`,
                    `(`,
                    `    select 'Spot' as pet_name`,
                    `    union all`,
                    `    select 'Jack' as pet_name`,
                    `    union all`,
                    `    select 'Max' as pet_name`,
                    `),`,
                    `r as`,
                    `(`,
                    `    select (floor(random() * (select count(*) from p))) + 1 as random_row_number`,
                    `),`,
                    `n as`,
                    `(`,
                    `    select pet_name, row_number() over (order by pet_name)`,
                    `    from p`,
                    `    order by pet_name`,
                    `)`,
                    `select n.pet_name`,
                    `from n`,
                    `join r on r.random_row_number = n.row_number`,                
                ].join("\n");
                const result = await db.query(query);
                process.stdout.write(`${result.rows[0].pet_name}\n`);
            } catch (error:any) {
                throw error;
            } finally {
                if (db) db.release();
                pool.end();
            }
        })
    }
})