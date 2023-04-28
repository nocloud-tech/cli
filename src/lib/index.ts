export type CliFunction = (args:string[]) => Promise<void>;

export type CliFunctionDictionary = {[key:string]:CliFunction};

export type ParameterisedCliFunction = <Parameter>(parameter:Parameter, args:string[]) => Promise<void>

export const CreateEmptyCliFunction = (fn:() => Promise<void>) : CliFunction => {
    return async(args:string[]) => {
        if (args.length) {
            throw new Error(`No arguments required.`);
        }

        return await fn();
    }
}

export const CreateEmptyParameterisedCliFunction = <Parameter>(creator:() => Promise<Parameter>, fn:(p:Parameter) => Promise<void>) : CliFunction => {
    return async(args:string[]) => {
        if (args.length) {
            throw new Error(`No arguments required.`);
        }

        const p = await creator();
        return await fn(p);
    }
}

export const CreateParameterisedCliFunction = <Parameter>(creator:() => Promise<Parameter>, fn:(parameter:Parameter, args:string[]) => Promise<void>) : CliFunction => {
    return async (args:string[]) => {
        const p = await creator();
        return await fn(p, args);
    }
}

export type RunOptions = {
    help?: string,
    functions: CliFunctionDictionary,
    action?: "log"|"throw"|"exit"
}

export const Run = async(options:RunOptions) => {
    const { help, functions, action } = options;

    let command:string|undefined;

    if ("undefined" != typeof help) {
        if ("undefined" != typeof functions.help) {
            throw new Error("A 'help' command was already provided.")
        }

        functions.help = async(args:string[]) => {
            if (args.length) {
                throw new Error("The 'help' command does not take additional arguments.");
            }
            process.stdout.write(`${help}\n`);
        }
    }

    try {
        const args = process.argv.slice(2);
    
        if (!args.length) {
            throw new Error(`Missing command.`);
        }
    
        command = args[0];
        const fn = functions[command];
    
        if (!fn) {
            throw new Error(`Unknown command '${command}'.`);
        }
        await fn(args.slice(1));
    } catch (error:any) {
        const message : string = error.message;
        if ("log" === action) {
            console.error(error);
        } else if ("throw" === action) {
            throw error;
        } else {
            process.stderr.write(`${message}\n`);
            process.exit(1);
        }
    }
}

export type BooleanArgument = {
    type: "boolean",
    boolean?: {
        defaultValue?: boolean,
    }
}

export type NumberArgument = {
    type: "number"
    number?: {
        defaultValue?: number,
    }
}

export type StringArgument = {
    type: "string",
    string?: {
        restrict?: string[],
        defaultValue?: string,
    }
}

export type GenericArgument = {
    short?: string,
    long?: string,
    description: string,
    required: boolean,
}

export type Argument = GenericArgument & (BooleanArgument|NumberArgument|StringArgument);

export type ArgumentSpecification = {[key:string]:Argument}

export const DescribeArguments = (spec:ArgumentSpecification) => {
    const cargs = Object.keys(spec)

    const out = (s:string) => {
        process.stdout.write(s);
    }

    for (let k = 0; k < cargs.length; ++k) {
        const property = cargs[k];
        const carg = spec[property];

        if (carg.short) {
            out(carg.short);
            if (carg.long) {
                out(",");
            }
        }
        if (carg.long) {
            out(carg.long);
        }
        out(` (${carg.type}, ` + (carg.required ? "required" : "optional") + ", ");
        if (carg.type == "boolean") {
            if (carg.boolean && carg.boolean.defaultValue) {
                out("default " + (carg.boolean.defaultValue ? "true" : "false"));
            } else {
                out("no default");
            }
        } else if (carg.type == "number") {
            if (carg.number && carg.number.defaultValue) {
                out("default " + carg.number.defaultValue);
            } else {
                out("no default");
            }
        } else if (carg.type == "string") {
            if (carg.string && carg.string.defaultValue) {
                out("default " + carg.string.defaultValue);
            } else {
                out("no default");
            }
        } else {
            throw new Error("Unknown type. This is a programming error.")
        }
        out(")\n");
        out(`  ${carg.description}\n`)
    }
}

export const ProcessArguments = <Result extends {[key:string]:any}>(args:string[], spec:ArgumentSpecification) => {
    let result : {[key:string]:any} = {};
    const cargs = Object.keys(spec)

    for (let k = 0; k < cargs.length; ++k) {
        const carg = spec[cargs[k]];
        if (!carg.short && !carg.long) {
            throw new Error("Each argument needs a short or long string.")
        }
    }

    for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        let found:number|undefined;
        for (let k = 0; k < cargs.length; ++k) {
            const carg = spec[cargs[k]];

            if (arg == carg.short || arg == carg.long) {
                found = k;
                break;
            }
        }

        if ("undefined" == typeof found) {
            throw new Error(`Unknown argument '${arg}'.`);
        }

        const property = cargs[found];
        const carg = spec[property];

        i += 1;
        if (i >= args.length) {
            throw new Error(`The ${arg} argument requires a value.`);
        }

        const value = args[i];
        if (carg.type == "boolean") {
            if (-1 !== ["yes", "true", "on", "1"].indexOf(value.toLowerCase())) {
                result[property] = true;
            } else if (-1 !== ["no", "false", "off", "0"].indexOf(value.toLowerCase())) {
                result[property] = false;
            } else {
                throw new Error(`The ${arg} argument must be 'yes', 'true', 'on', '1' or 'no', 'false', 'off', '0'.`);
            }
        } else if (carg.type == "number") {
            const f = parseFloat(value);
            if (isNaN(f)) {
                throw new Error(`The ${arg} argument must be a number.`);
            }

            result[property] = f;
        } else if (carg.type == "string") {
            if (carg.string && carg.string.restrict && -1 === carg.string.restrict.indexOf(value)) {
                throw new Error(`The value supplied to the ${arg} argument is not recognised.`);
            }
            result[property] = value;
        } else {
            throw new Error(`The ${arg} argument had an unknown type. This is a programming error.`);
        }
    }

    for (let k = 0; k < cargs.length; ++k) {
        const property = cargs[0];
        const carg = spec[property];
        const name = carg.short || carg.long;

        if (carg.required) {
            if ("undefined" == typeof result[property]) {
                throw new Error(`The ${name} argument is required.`);
            }
        } else {
            if ("undefined" == typeof result[property]) {
                if (carg.type == "boolean" && carg.boolean && "undefined" != typeof carg.boolean.defaultValue) {
                    result[property] = carg.boolean.defaultValue;
                } else if (carg.type == "number" && carg.number && "undefined" != typeof carg.number.defaultValue) {
                    result[property] = carg.number.defaultValue;
                } else if (carg.type == "string" && carg.string && "undefined" != typeof carg.string.defaultValue) {
                    result[property] = carg.string.defaultValue;
                }
            }
        }
    }

    return <Result>result;
}