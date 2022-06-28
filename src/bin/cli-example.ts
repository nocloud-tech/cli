#!/usr/bin/env node
import * as cli from "../lib"
import { Client, Pool, PoolClient } from "pg"

const ConnectToPg = async() => {
    return new Pool();
}

cli.Run({
    help: async() => {

        const message =
`cli-example
  An example of how to use the CLI library.

Commands
  help
    Display this help message.

  pet
    Echo a random pet name from a hard-coded array
    of pet names.

  pet-postgres
    Echo a random pet name from a hard-coded temporary
    PostgreSQL table (Common Table Expression) of pet
    names. This tests the parameter creation functionality.
`
        process.stdout.write(message);
    },
    pet: async (args:string[]) => {
        const names = [
            "Milky", "Sooty", "Tanooky",
        ];

        const i = Math.floor(Math.random() * (names.length));
        process.stdout.write(`${names[i]}\n`);
    },
    "pet-postgres": cli.CreateParameterisedCliFunction(ConnectToPg, async(pool:Pool, args:string[]) => {
        let db : PoolClient|undefined;
        try {
            db = await pool.connect();
            const query =
`
with
p as
(
    select 'Milky' as pet_name
    union all
    select 'Sooty' as pet_name
    union all
    select 'Tanooky' as pet_name
),
r as
(
    select (floor(random() * (select count(*) from p))) + 1 as random_row_number
),
n as
(
    select pet_name, row_number() over (order by pet_name)
    from p
    order by pet_name
)
select n.pet_name
from n
join r on r.random_row_number = n.row_number
`;
            const result = await db.query(query);
            process.stdout.write(`${result.rows[0].pet_name}\n`);
        } catch (error:any) {
            throw error;
        } finally {
            if (db) db.release();
            pool.end();
        }
    })
})