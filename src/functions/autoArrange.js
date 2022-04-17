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
    if (screen != undefined) {
        visible = visible.filter(w => w.screen.id === screen);
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
    let expectedBounds;
    if (windows.length === 1) {
        windows[0].moveResize({ left: monitorBounds.left, top: monitorBounds.top, width: monitorBounds.width, height: monitorBounds.height });
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
                win.moveResize({
                    top: expectedBounds.top,
                    left: expectedBounds.left,
                    width: expectedBounds.width,
                    height: expectedBounds.height
                });
                expectedBounds.left = expectedBounds.left + expectedBounds.width;
                win.focus();
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
                win.moveResize({
                    top: expectedBounds.top,
                    left: expectedBounds.left,
                    width: expectedBounds.width,
                    height: expectedBounds.height
                });
                expectedBounds.left = expectedBounds.left + expectedBounds.width;
                win.focus();
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
        firstWin.focus();
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
                win.moveResize({
                    top: expectedBounds.top,
                    left: expectedBounds.left,
                    width: expectedBounds.width,
                    height: expectedBounds.height
                });
                expectedBounds.left = expectedBounds.left + expectedBounds.width;
                win.focus();
            }
            expectedBounds.top = expectedBounds.top + expectedBounds.height;
            expectedBounds.left = firstWinBounds.width;
        }
    }
}
async function addFrameButton(window) {
    const icon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFySURBVDiNxZA9LENhFIaf813R9jYGgxiIkBjQsPgbLMRCE2IyW5gYSGq2S+w2q01IWotgEPEXCcEiSMSgm0i/tjdxj0HLdTsw8U4n7/ne5zvnwH9LykXd9N4d0BJoeBgGs6uDhwCJTK63qO7FbVKKQYAJ1C3BhkK1Ko0A7Rk776scRcR2hScwYSOsRCbXi7ICiK9y3Ja2jx3p3OivAbmoewnslNZKCZwqsloBEPAqxvN972FICu5bbBxl2Tisi+oaUF9+U/X1XIYQbQiGa2KF7WfgbEwssAjQmtaso3agAlA70eO9ibsZvPIz0DqXjrzmoyO+MdUALxv7iMpTBcCIHDhqJxNb+XPf6Kzrx5bOxsS+5qMjvpgNNLicekDk2w0UsioypY5OIqSsk99s3tVo+edvcfj0zFehM0C3wnLJGo4XbGc4HNYn4DoZz9wk3SYj2gcowsLVaPzkJ0BV2CiqexER218OfxxMveDYwP1P4L/TOwCoibyux1ORAAAAAElFTkSuQmCC";
    const buttonInfo = {
        buttonId: "swapBounds",
        tooltip: "swap-bounds",
        order: 1,
        imageBase64: icon
    };
    await window.addFrameButton(buttonInfo);
}
export async function autoArrange({ ignoreList, addFrameButtons, onlyNormal, screen, appManagerName }) {
    const filteredWindows = getWindows({ ignoreList, onlyNormal, screen });
    const windows = [];
    const state = [];
    let swapBoundsArr = [];
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
            groupInfo
        });
        if (win.mode === 'tab') {
            if (windows.filter(w => w.tabGroupId === win.tabGroupId).length === 0) {
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
        if (addFrameButtons) {
            await addFrameButton(window);
            const clickHandler = (button) => {
                if (button.buttonId === "swapBounds") {
                    swapBoundsArr.push({
                        win: window,
                        oldBounds: window.bounds
                    });
                    if (swapBoundsArr.length === 2) {
                        swapBoundsArr[0].win.moveResize(swapBoundsArr[1].oldBounds);
                        swapBoundsArr[1].win.moveResize(swapBoundsArr[0].oldBounds);
                        swapBoundsArr = [];
                    }
                }
            };
            window.onFrameButtonClicked(clickHandler);
        }
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
    for (const stateObj of state) {
        await stateObj.win.moveResize(stateObj.bounds);
        const buttonID = "swapBounds";
        if (stateObj.win.frameButtons.filter(a => a.buttonId === buttonID).length > 0) {
            await stateObj.win.removeFrameButton(buttonID);
        }
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
}
// -- Example --
// const toolbarName = 'toolbar-launchpad'
// const static = await autoArrange({ignoreList: [toolbarName], onlyNormal: true, screen: 0, addFrameButtons: true, appManagerName: toolbarName});
// restoreBounds(static);
