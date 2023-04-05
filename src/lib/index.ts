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

