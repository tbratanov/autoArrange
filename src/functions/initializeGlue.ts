import Glue from "@glue42/desktop";

export async function initGlue(config?) {
    let glue: any;
    if (glue) {
        return glue;
    }
    return glue = await Glue(config);
}