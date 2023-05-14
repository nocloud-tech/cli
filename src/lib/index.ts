
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
        out(")\n\n");
        out(`  ${carg.description}\n\n`)
    }
}

export const ProcessArguments = (args:string[], spec:ArgumentSpecification) => {
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
        const property = cargs[k];
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

    return result;
}

export type Callback = (args:any) => Promise<void>

export type CallbackCommand = {
    type: "callback",
    callback: Callback,
    arguments?: ArgumentSpecification
}

export type SubcommandsCommand = {
    type: "subcommands",
    subcommands: CommandSpecification,
}

export type GenericCommand = {
    description: string,
}

export type Command = GenericCommand & (CallbackCommand|SubcommandsCommand);

export type CommandSpecification = {[key:string]:Command};

export type ParameterisedCommand = <Parameter>(parameter:Parameter, args:any) => Promise<void>

export const CreateParameterisedCommand = <Parameter>(creator:() => Promise<Parameter>, fn:(parameter:Parameter, args:any) => Promise<void>) => {
    return async (args:any) => {
        const p = await creator();
        return await fn(p, args);
    }
}

const DescribeCommand = (command:Command) => {
    const out = (s:string) => process.stdout.write(s);

    if (command.type == "callback") {
        out("DESCRIPTION\n\n");
        out(`${command.description}\n\n`);
        if (command.arguments) {
            out("ARGUMENTS\n\n");
            DescribeArguments(command.arguments);
        }
    } else if (command.type == "subcommands") {
        out("DESCRIPTION\n\n");
        out(`${command.description}\n\n`);
        out("COMMANDS\n\n");
        const keys = Object.keys(command.subcommands).sort();
        for (let i = 0; i < keys.length; ++i) {
            const s = keys[i];
            out(`  ${s}\n`);
        }
        out("\n");
    }
}

export type RunOptions = {
    description: string,
    commands: CommandSpecification,
    action?: "log"|"throw"|"exit"
}

const DoRun = async(args:string[], commands:CommandSpecification, depth = 0) => {
    const commandDepth = depth ? "subcommand" : "command";

    if (!args.length) {
        throw new Error(`Missing ${commandDepth}. Use 'help'.`);
    }

    const cmd = commands[args[0]];

    if (!cmd) {
        throw new Error(`Unknown command '${args[0]}'. Use 'help'.`);
    }

    const newArgs = args.slice(1);

    if (cmd.type == "callback") {
        const cargs = ProcessArguments(newArgs, cmd.arguments || {});
        await cmd.callback(cargs);
    } else if (cmd.type == "subcommands") {
        await DoRun(newArgs, cmd.subcommands);
    } else {
        throw new Error("Unknown command type. This is a programming error.");
    }
}

type HelpArguments = {
    command?: string,
}

export const Run = async(options:RunOptions) => {
    const { description, commands, action } = options;

    if (!commands.help) {
        commands.help = {
            description: "Display help information.",
            type: "callback",
            arguments: {
                command: {
                    short: "-c",
                    long: "--command",
                    required: false,
                    description: [
                        `The command for which help information should be displayed.`,
                        `You can specificy nested commands with dot-separators. For example,`,
                        `'<COMMAND>.<SUBCOMMAND>'.`
                    ].join(" "),
                    type: "string",
                }
            },
            callback: async(args:HelpArguments) => {
                let program : Command = {
                    description: [
                        `${description}\n\n` +
                        "These are the top-level commands available.",
                        "Use '--command <COMMAND>' to get further help on a particular command.",
                        "Subcommands work the same way, e.g., '--command <COMAMND>.<SUBCOMMAND>'."
                    ].join(" "),
                    type: "subcommands",
                    subcommands: commands,
                };

                if (!args.command) {
                    DescribeCommand(program)
                } else { 
                    const parts = args.command.split(".");
                    let parent : Command = program;
                    let target : Command|undefined;
                    for (let i = 0; i < parts.length; ++i) {
                        if (!parent) break;

                        const part = parts[i];
                        if (parent.type != "subcommands") {
                            throw new Error(`Invalid command/subcommand.`);
                        }
                        
                        target = parent.subcommands[part];
                        if (i < parts.length) {
                            parent = target;
                        }
                    }

                    if (!target) {
                        throw new Error(`Unknown command/subcommand.`);
                    }
                    
                    DescribeCommand(target);
                }
            }
        }
    }

    try {
        const args = process.argv.slice(2);
        await DoRun(args, commands);
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
