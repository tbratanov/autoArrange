import { initGlue } from "./initializeGlue";
let glue;
initGlue()
    .then((g) => {
    glue = g;
})
    .catch((error) => {
    console.log(error);
});
function getWindows({ ignoreList, onlyNormal, screen }) {
    let visible = glue.windows.list().filter(w => w.isVisible);
    if (ignoreList.length > 0) {
        visible = visible.filter(w => !ignoreList.includes(w.application && w.application.name));
    }
    if (onlyNormal) {
        visible = visible.filter(w => w.state !== undefined);
        visible = visible.filter(w => w.state.toLowerCase() === 'normal');
    }
    if (screen !== 'All') {
        visible = visible.filter(w => w.screen.id === parseInt(screen));
    }
    return visible;
}
function splitWindows(array, expectedGroupSize) {
    const rows = [];
    let i = 0;
    const n = array.length;
    while (i < n) {
        rows.push(array.slice(i, i += expectedGroupSize));
    }
    return rows;
}
async function arrangeWindows(windows, monitorBounds) {
    const stickyWins = [];
    await Promise.all(windows.map(async (window) => {
        if (window.isSticky) {
            stickyWins.push(window);
        }
        await window.setSticky(false);
        await window.hide();
    }));
    let expectedBounds;
    if (windows.length === 1) {
        await windows[0].moveResize({ left: monitorBounds.left, top: monitorBounds.top, width: monitorBounds.width, height: monitorBounds.height });
    }
    else if (windows.length % 3 === 0) {
        const columns = splitWindows(windows, 3);
        expectedBounds = {
            top: monitorBounds.top,
            left: monitorBounds.left,
            width: monitorBounds.width / 3,
            height: monitorBounds.height / columns.length
        };
        for (const column of columns) {
            for (const win of column) {
                await win.moveResize({
                    top: expectedBounds.top,
                    left: expectedBounds.left,
                    width: expectedBounds.width,
                    height: expectedBounds.height
                });
                expectedBounds.left = expectedBounds.left + expectedBounds.width;
            }
            expectedBounds.top = expectedBounds.top + expectedBounds.height;
            expectedBounds.left = monitorBounds.left;
        }
    }
    else if (windows.length % 2 === 0) {
        const numberOfRows = windows.length / 2;
        const rows = splitWindows(windows, numberOfRows);
        expectedBounds = {
            top: monitorBounds.top,
            left: monitorBounds.left,
            width: monitorBounds.width / numberOfRows,
            height: monitorBounds.height / 2
        };
        for (const row of rows) {
            for (const win of row) {
                await win.moveResize({
                    top: expectedBounds.top,
                    left: expectedBounds.left,
                    width: expectedBounds.width,
                    height: expectedBounds.height
                });
                expectedBounds.left = expectedBounds.left + expectedBounds.width;
            }
            expectedBounds.top = expectedBounds.top + expectedBounds.height;
            expectedBounds.left = monitorBounds.left;
        }
    }
    else {
        const firstWin = windows[0];
        await firstWin.moveResize({
            left: monitorBounds.left,
            top: monitorBounds.top,
            height: monitorBounds.height,
            width: monitorBounds.width / 3
        });
        windows.shift();
        const firstWinBounds = firstWin.bounds;
        const numberOfRows = windows.length / 2;
        const rows = splitWindows(windows, numberOfRows);
        expectedBounds = {
            top: monitorBounds.top,
            left: firstWinBounds.width,
            width: (monitorBounds.width - firstWinBounds.width) / numberOfRows,
            height: monitorBounds.height / 2
        };
        for (const row of rows) {
            for (const win of row) {
                await win.moveResize({
                    top: expectedBounds.top,
                    left: expectedBounds.left,
                    width: expectedBounds.width,
                    height: expectedBounds.height
                });
                expectedBounds.left = expectedBounds.left + expectedBounds.width;
            }
            expectedBounds.top = expectedBounds.top + expectedBounds.height;
            expectedBounds.left = firstWinBounds.width;
        }
        windows.unshift(firstWin);
    }
    for (const win of windows) {
        win.show();
    }
    for (const win of stickyWins) {
        win.setSticky(true);
    }
}
export async function autoArrange({ ignoreList, onlyNormal, screen, appManagerName }) {
    const filteredWindows = getWindows({ ignoreList, onlyNormal, screen });
    const windows = [];
    const state = [];
    filteredWindows.forEach((win) => {
        let groupInfo;
        if (win.leftNeighbours.length > 0) {
            groupInfo = {
                direction: 'right',
                neighbour: win.leftNeighbours
            };
        }
        else if (win.rightNeighbours.length > 0) {
            groupInfo = {
                direction: 'left',
                neighbour: win.rightNeighbours
            };
        }
        else if (win.bottomNeighbours.length > 0) {
            groupInfo = {
                direction: 'top',
                neighbour: win.bottomNeighbours
            };
        }
        else if (win.topNeighbours.length > 0) {
            groupInfo = {
                direction: 'bottom',
                neighbour: win.topNeighbours
            };
        }
        state.push({
            win,
            bounds: win.bounds,
            state: win.state,
            isSticky: win.isSticky,
            groupInfo
        });
        if (win.mode === 'tab') {
            if (win.tabGroupId) {
                if (windows.filter(w => w.tabGroupId === win.tabGroupId).length === 0) {
                    windows.push(win);
                }
            }
            else {
                windows.push(win);
            }
        }
        else {
            windows.push(win);
        }
    });
    const displays = await glue.displays.all();
    displays.forEach((display) => {
        display.windows = [];
    });
    for (const window of windows) {
        if (window.state !== 'normal') {
            await window.restore();
        }
        displays[window.screen.id].windows.push(window);
    }
    for (const display of displays) {
        if (appManagerName) {
            const [appManager] = glue.windows.list().filter(w => appManagerName.includes(w.application && w.application.name));
            if (appManager.screen.id === display.index) {
                if (appManager.bounds.width === display.workArea.width) {
                    appManager.focus();
                    const workArea = display.workArea;
                    workArea.top = workArea.top + appManager.bounds.height;
                    workArea.height = workArea.height - appManager.bounds.height;
                    await arrangeWindows(display.windows, workArea);
                }
                else {
                    await arrangeWindows(display.windows, display.workArea);
                }
            }
            else {
                await arrangeWindows(display.windows, display.workArea);
            }
        }
        else {
            await arrangeWindows(display.windows, display.workArea);
        }
    }
    return state;
}
export async function restoreBounds(state) {
    await Promise.all(state.map(async (stateObj) => {
        await stateObj.win.hide();
        await stateObj.win.setSticky(false);
    }));
    for (const stateObj of state) {
        await stateObj.win.moveResize(stateObj.bounds);
    }
    for (const stateObj of state) {
        if (stateObj.groupInfo) {
            if (stateObj.win.leftNeighbours.length === 0 && stateObj.win.rightNeighbours.length === 0 && stateObj.win.topNeighbours.length === 0 && stateObj.win.bottomNeighbours.length === 0) {
                await stateObj.win.snap(stateObj.groupInfo.neighbour[0], stateObj.groupInfo.direction);
            }
        }
    }
    for (const stateObj of state) {
        if (stateObj.state === 'maximized') {
            if (stateObj.groupInfo) {
                stateObj.win.group.maximize();
            }
            else {
                stateObj.win.maximize();
            }
        }
        if (stateObj.state === 'minimized') {
            stateObj.win.minimize();
        }
    }
    state.forEach((obj) => {
        obj.win.show();
        if (obj.isSticky) {
            obj.win.setSticky(true);
        }
    });
}
// -- Example --
// const toolbarName = 'toolbar-launchpad'
// const static = await autoArrange({ignoreList: [toolbarName], onlyNormal: true, screen: 'All', appManagerName: toolbarName});
// restoreBounds(static);
