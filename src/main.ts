import { autoArrange, restoreBounds } from "./functions/autoArrange";
import { initGlue } from "./functions/initializeGlue";

document.addEventListener('DOMContentLoaded', () => {
    handleDOMReady();
});

async function handleDOMReady() {
    await populateMonitors();
    await checkMLP();
    const addButton = document.querySelector('#addToIgnoreList');
    addButton.addEventListener("click", populateIgnoreList)
    const autoArrangeButton = document.querySelector('#autoArrange')
    autoArrangeButton.addEventListener("click", autoArrangeApps)
    const restoreBoundsButton = document.querySelector('#restoreBoundsButton');
    restoreBoundsButton.addEventListener("click", restoreBoundsToApps)
}

const ignoreList = [
    'autoArrangeApp'
];

let state;



function populateIgnoreList() {
    const ignoreInput = (<HTMLInputElement>document.querySelector('#ignoreApps'));
    const value = ignoreInput.value;
    ignoreList.push(value);
    const listGrp = document.querySelector('.list-group')
    let listGrpHTML = '';
    ignoreList.forEach((app) => {
        listGrpHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">${app}</li>`
    })
    listGrp.innerHTML = listGrpHTML;
}

async function populateMonitors() {
    const glue = await initGlue();
    const monitors = await glue.displays.all();
    let monitorsHTML = "";

    const monitorDropDown = document.querySelector('#screens');
    monitors
        .forEach((monitor) => {
            monitorsHTML += `<option>${monitor.index}</option>`
        })
    monitorDropDown.innerHTML = `<option>All</option>${monitorsHTML}`;
}

async function checkMLP () {
    const glue = await initGlue();
    if(glue.windows.list().filter(w => w.name === 'toolbar-launchpad').length > 0) {
        const div: HTMLDivElement = document.querySelector('#MLPToolbar');
        div.style.display = 'block';
    }
}

async function autoArrangeApps() {
    const displayOnMonitor = (<HTMLSelectElement>document.querySelector('#screens')).value;
    const onlyNormal = (<HTMLInputElement>document.querySelector('#onlyNormal')).checked;
    const frameButtons = (<HTMLInputElement>document.querySelector('#addFrameButtons')).checked;
    const displayToolbar = (<HTMLInputElement>document.querySelector('#mlpToolbar')).checked;

    let appManager;
    if (displayToolbar) {
        appManager = 'toolbar-launchpad'
    }

    try { 
        state = await autoArrange({ ignoreList: ignoreList, onlyNormal: onlyNormal, screen: displayOnMonitor, addFrameButtons: frameButtons, appManagerName: appManager }) 
    } catch (error) {
        console.warn(error)
    }
    
    const restoreBoundsButt = document.querySelector('#restoreBoundsButton')
    restoreBoundsButt.className = 'btn btn-primary';
}

async function restoreBoundsToApps() {
    if (state) {
        await restoreBounds(state)
        const restoreBoundsButt = document.querySelector('#restoreBoundsButton')
        restoreBoundsButt.className = 'btn btn-primary disabled';
    }
}