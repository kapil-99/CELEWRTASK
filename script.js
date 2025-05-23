const SHEET_ID = '12HzUj1xQ2_jTzVaqzGWyJ65chBOaI9Ii-AEALAGQLFU';
const API_KEY = 'AIzaSyBTTfWsrH3vXZA7EVE9mCc4wne8p1sA9TU';
const TRF_RANGE = 'trf!A1:AH';
const IRF_RANGE = 'irf!A1:AH';
const TRF_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${TRF_RANGE}?key=${API_KEY}`;
const IRF_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${IRF_RANGE}?key=${API_KEY}`;

let trfData = [];
let irfData = [];

const formatDate = (date) => date.toISOString().split('T')[0];

const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const [day, month, year] = dateStr.split('-');
    const monthMap = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };
    const monthIndex = monthMap[month?.toLowerCase()];
    if (monthIndex === undefined || !year || !day) return null;
    return new Date(year, monthIndex, day);
};

const sanitizeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
};

const formatNumber = (num) => num === 0 ? '-' : num.toLocaleString('en-US');

// Set default dates: End Date = yesterday, Start Date = day before yesterday
const setDefaultDates = () => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // yesterday
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 1); // day before yesterday

    const endDateInput = document.getElementById('endDate');
    const startDateInput = document.getElementById('startDate');
    if (endDateInput) endDateInput.value = formatDate(endDate);
    if (startDateInput) startDateInput.value = formatDate(startDate);

    document.getElementById('dateRangeInput').classList.add('hidden');
};

const toggleDateSelection = (selected) => {
    const betweenDate = document.getElementById('betweenDate');
    const dateRange = document.getElementById('dateRange');
    const betweenDateInputs = document.getElementById('betweenDateInputs');
    const dateRangeInput = document.getElementById('dateRangeInput');

    if (selected === 'betweenDate') {
        betweenDate.checked = true;
        dateRange.checked = false;
        betweenDateInputs.classList.remove('hidden');
        dateRangeInput.classList.add('hidden');
    } else {
        betweenDate.checked = false;
        dateRange.checked = true;
        betweenDateInputs.classList.add('hidden');
        dateRangeInput.classList.remove('hidden');
        handleDateRangeChange();
    }
};

const handleDateRangeChange = () => {
    const days = parseInt(document.getElementById('dateRangeSelect').value);
    if (!days) return;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (days - 1));
    document.getElementById('startDate').value = formatDate(startDate);
    document.getElementById('endDate').value = formatDate(endDate);
    fetchData();
};

const handleEndDateChange = () => {
    const endDateInput = document.getElementById('endDate').value;
    if (endDateInput) {
        const endDate = new Date(endDateInput);
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 1);
        document.getElementById('startDate').value = formatDate(startDate);
    }
    fetchData();
};

const populateDivisionFilter = () => {
    const divisions = new Set();
    [...trfData.slice(1), ...irfData.slice(1)]
        .filter(row => row[8] && row[8].trim() !== '') // Exclude blank Col I
        .forEach(row => {
            const div = row[0]?.trim();
            if (div) divisions.add(div.toUpperCase());
        });
    const divisionFilter = document.getElementById('divisionFilter');
    const currentValue = divisionFilter.value;
    divisionFilter.innerHTML = '<option value="">All Divisions</option>';
    [...divisions].sort().forEach(div => {
        const option = document.createElement('option');
        option.value = div;
        option.textContent = div;
        divisionFilter.appendChild(option);
    });
    if (currentValue && divisions.has(currentValue.toUpperCase())) {
        divisionFilter.value = currentValue;
    }
};

const fetchData = async () => {
    const trainSummaryTable = document.getElementById('trainSummaryTable');
    trainSummaryTable.innerHTML = '<p>Loading...</p>';
    const betweenDateChecked = document.getElementById('betweenDate').checked;
    const dateRangeChecked = document.getElementById('dateRange').checked;

    if (betweenDateChecked && (!document.getElementById('startDate').value || !document.getElementById('endDate').value)) {
        alert('Please select both start and end dates.');
        trainSummaryTable.innerHTML = '<p>Please select dates.</p>';
        return;
    }
    if (dateRangeChecked && !document.getElementById('dateRangeSelect').value) {
        alert('Please select a date range.');
        trainSummaryTable.innerHTML = '<p>Please select a date range.</p>';
        return;
    }

    try {
        const [trfResponse, irfResponse] = await Promise.all([fetch(TRF_URL), fetch(IRF_URL)]);
        if (!trfResponse.ok || !irfResponse.ok) {
            throw new Error('Network error fetching data.');
        }
        const trfResult = await trfResponse.json();
        const irfResult = await irfResponse.json();
        if (!trfResult.values || trfResult.values.length < 2 || !irfResult.values || irfResult.values.length < 2) {
            throw new Error('No data found in sheets.');
        }
        trfData = trfResult.values;
        irfData = irfResult.values;
        populateDivisionFilter();
        updateDashboard();
    } catch (error) {
        console.error('Error:', error);
        trainSummaryTable.innerHTML = `<p>Error loading data: ${sanitizeHTML(error.message)}</p>`;
    }
};

const applyFilters = (data) => {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const division = document.getElementById('divisionFilter').value.toUpperCase();

    if (!startDate || !endDate) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
        alert('Start date cannot be later than end date.');
        return [];
    }

    return data.slice(1).filter(row => {
        const date = parseDate(row[33]);
        const div = row[0]?.trim().toUpperCase();
        const rakeType = row[8]?.trim();
        const dateMatch = date && date >= start && date <= end;
        const divMatch = !division || div === division;
        const rakeMatch = rakeType && rakeType !== '';
        return dateMatch && divMatch && rakeMatch;
    });
};

const getLinkStatus = (row) => {
    const locoLinkRly = (row[10] || '').trim().toUpperCase();
    const homeShed = (row[14] || '').trim().toUpperCase();
    if (locoLinkRly === 'WR' && homeShed === 'WR') {
        return 'link';
    } else if (locoLinkRly === 'WR' && homeShed !== 'WR') {
        return 'mis_link';
    } else if (locoLinkRly !== 'WR' && homeShed === 'WR') {
        return 'FR_link_WR';
    } else if (locoLinkRly !== 'WR') {
        return 'FR_link';
    }
    return 'N/A';
};

const isGLoco = (row) => {
    const locoType = (row[15] || '').trim().toUpperCase();
    return locoType.includes('WAG');
};

const getHOGStatus = (row) => {
    const locoLinkRly = (row[10] || '').trim().toUpperCase();
    const hogProvision = (row[11] || '').trim().toUpperCase();
    const locoType = (row[16] || '').trim().toUpperCase();
    const rakeType = (row[8] || '').trim().toUpperCase();
    if (hogProvision === 'NO' && rakeType) {
        return 'Not Req_HOG';
    } else if (locoLinkRly === 'WR' && hogProvision === 'YES' && locoType === 'NON HOG' && rakeType === 'LHB') {
        return 'Mis_HOG';
    } else if (locoLinkRly === 'WR' && hogProvision === 'YES' && locoType === 'HOG' && rakeType === 'LHB') {
        return 'HOG_Right';
    }
    return 'N/A';
};

const updateDashboard = () => {
    const filteredTrfData = applyFilters(trfData);
    const filteredIrfData = applyFilters(irfData);
    if (!filteredTrfData.length && !filteredIrfData.length) {
        document.getElementById('trainSummaryTable').innerHTML = '<p>No data found for the selected filters.</p>';
        return;
    }

    const isTOD = row => row[4]?.toLowerCase().includes('tod');
    const isLHB = row => row[8]?.toUpperCase().includes('LHB');
    const isICF = row => row[8]?.toUpperCase().includes('ICF');

    const trfRegTrains = filteredTrfData.filter(row => !isTOD(row));
    const trfTodTrains = filteredTrfData.filter(isTOD);
    const irfRegTrains = filteredIrfData.filter(row => !isTOD(row));
    const irfTodTrains = filteredIrfData.filter(isTOD);

    const countByStatus = (data, statusFn, status, rakeType = null) => {
        const count = data.filter(row => {
            const matchesStatus = statusFn(row) === status;
            if (rakeType === 'LHB') return matchesStatus && isLHB(row);
            if (rakeType === 'ICF') return matchesStatus && isICF(row);
            return matchesStatus;
        }).length;
        return formatNumber(count);
    };

    const countMisLinkGLoco = (data, rakeType = null) => {
        const count = data.filter(row => {
            const matchesStatus = getLinkStatus(row) === 'mis_link' && isGLoco(row);
            if (rakeType === 'LHB') return matchesStatus && isLHB(row);
            if (rakeType === 'ICF') return matchesStatus && isICF(row);
            return matchesStatus;
        }).length;
        return formatNumber(count);
    };

    const countMisHOGGLoco = (data, rakeType = null) => {
        const count = data.filter(row => {
            const matchesStatus = getHOGStatus(row) === 'Mis_HOG' && isGLoco(row);
            if (rakeType === 'LHB') return matchesStatus && isLHB(row);
            if (rakeType === 'ICF') return matchesStatus && isICF(row);
            return matchesStatus;
        }).length;
        return formatNumber(count);
    };

    const renderSummaryRow = (label, status, type, isMis = false) => {
        const rowClass = isMis ? 'mis-row' : '';
        return `
            <tr class="${rowClass}">
                <td>${sanitizeHTML(label)}</td>
                <td class="trf-cell ${status === 'mis_link' || status === 'Mis_HOG' ? 'highlight-red' : ''}"><a href="#" onclick="event.preventDefault();showPopup('trf_reg', '${status}')" aria-label="View TRF Regular ${label}">${countByStatus(trfRegTrains, type === 'link' ? getLinkStatus : getHOGStatus, status)}</a></td>
                <td class="trf-cell ${status === 'mis_link' || status === 'Mis_HOG' ? 'highlight-red' : ''}"><a href="#" onclick="event.preventDefault();showPopup('trf_reg', '${status}_lhb')" aria-label="View TRF Regular ${label} LHB">${countByStatus(trfRegTrains, type === 'link' ? getLinkStatus : getHOGStatus, status, 'LHB')}</a></td>
                <td class="trf-cell ${status === 'mis_link' || status === 'Mis_HOG' ? 'highlight-red' : ''}"><a href="#" onclick="event.preventDefault();showPopup('trf_reg', '${status}_icf')" aria-label="View TRF Regular ${label} ICF">${countByStatus(trfRegTrains, type === 'link' ? getLinkStatus : getHOGStatus, status, 'ICF')}</a></td>
                <td class="trf-cell ${status === 'mis_link' || status === 'Mis_HOG' ? 'highlight-red' : ''}"><a href="#" onclick="event.preventDefault();showPopup('trf_tod', '${status}')" aria-label="View TRF TOD ${label}">${countByStatus(trfTodTrains, type === 'link' ? getLinkStatus : getHOGStatus, status)}</a></td>
                <td class="trf-cell ${status === 'mis_link' || status === 'Mis_HOG' ? 'highlight-red' : ''}"><a href="#" onclick="event.preventDefault();showPopup('trf_tod', '${status}_lhb')" aria-label="View TRF TOD ${label} LHB">${countByStatus(trfTodTrains, type === 'link' ? getLinkStatus : getHOGStatus, status, 'LHB')}</a></td>
                <td class="trf-cell ${status === 'mis_link' || status === 'Mis_HOG' ? 'highlight-red' : ''}"><a href="#" onclick="event.preventDefault();showPopup('trf_tod', '${status}_icf')" aria-label="View TRF TOD ${label} ICF">${countByStatus(trfTodTrains, type === 'link' ? getLinkStatus : getHOGStatus, status, 'ICF')}</a></td>
                <td class="irf-cell ${status === 'mis_link' || status === 'Mis_HOG' ? 'highlight-red' : ''}"><a href="#" onclick="event.preventDefault();showPopup('irf_reg', '${status}')" aria-label="View IRF Regular ${label}">${countByStatus(irfRegTrains, type === 'link' ? getLinkStatus : getHOGStatus, status)}</a></td>
                <td class="irf-cell ${status === 'mis_link' || status === 'Mis_HOG' ? 'highlight-red' : ''}"><a href="#" onclick="event.preventDefault();showPopup('irf_reg', '${status}_lhb')" aria-label="View IRF Regular ${label} LHB">${countByStatus(irfRegTrains, type === 'link' ? getLinkStatus : getHOGStatus, status, 'LHB')}</a></td>
                <td class="irf-cell ${status === 'mis_link' || status === 'Mis_HOG' ? 'highlight-red' : ''}"><a href="#" onclick="event.preventDefault();showPopup('irf_reg', '${status}_icf')" aria-label="View IRF Regular ${label} ICF">${countByStatus(irfRegTrains, type === 'link' ? getLinkStatus : getHOGStatus, status, 'ICF')}</a></td>
                <td class="irf-cell ${status === 'mis_link' || status === 'Mis_HOG' ? 'highlight-red' : ''}"><a href="#" onclick="event.preventDefault();showPopup('irf_tod', '${status}')" aria-label="View IRF TOD ${label}">${countByStatus(irfTodTrains, type === 'link' ? getLinkStatus : getHOGStatus, status)}</a></td>
                <td class="irf-cell ${status === 'mis_link' || status === 'Mis_HOG' ? 'highlight-red' : ''}"><a href="#" onclick="event.preventDefault();showPopup('irf_tod', '${status}_lhb')" aria-label="View IRF TOD ${label} LHB">${countByStatus(irfTodTrains, type === 'link' ? getLinkStatus : getHOGStatus, status, 'LHB')}</a></td>
                <td class="irf-cell ${status === 'mis_link' || status === 'Mis_HOG' ? 'highlight-red' : ''}"><a href="#" onclick="event.preventDefault();showPopup('irf_tod', '${status}_icf')" aria-label="View IRF TOD ${label} ICF">${countByStatus(irfTodTrains, type === 'link' ? getLinkStatus : getHOGStatus, status, 'ICF')}</a></td>
            </tr>
        `;
    };

    const renderMisLinkGLocoRow = () => {
        return `
            <tr class="mis-row">
                <td>Mis Link from G_loco</td>
                <td class="trf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('trf_reg', 'mis_link_g_loco')" aria-label="View TRF Regular Mis Link from G_loco">${countMisLinkGLoco(trfRegTrains)}</a></td>
                <td class="trf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('trf_reg', 'mis_link_g_loco_lhb')" aria-label="View TRF Regular Mis Link from G_loco LHB">${countMisLinkGLoco(trfRegTrains, 'LHB')}</a></td>
                <td class="trf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('trf_reg', 'mis_link_g_loco_icf')" aria-label="View TRF Regular Mis Link from G_loco ICF">${countMisLinkGLoco(trfRegTrains, 'ICF')}</a></td>
                <td class="trf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('trf_tod', 'mis_link_g_loco')" aria-label="View TRF TOD Mis Link from G_loco">${countMisLinkGLoco(trfTodTrains)}</a></td>
                <td class="trf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('trf_tod', 'mis_link_g_loco_lhb')" aria-label="View TRF TOD Mis Link from G_loco LHB">${countMisLinkGLoco(trfTodTrains, 'LHB')}</a></td>
                <td class="trf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('trf_tod', 'mis_link_g_loco_icf')" aria-label="View TRF TOD Mis Link from G_loco ICF">${countMisLinkGLoco(trfTodTrains, 'ICF')}</a></td>
                <td class="irf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('irf_reg', 'mis_link_g_loco')" aria-label="View IRF Regular Mis Link from G_loco">${countMisLinkGLoco(irfRegTrains)}</a></td>
                <td class="irf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('irf_reg', 'mis_link_g_loco_lhb')" aria-label="View IRF Regular Mis Link from G_loco LHB">${countMisLinkGLoco(irfRegTrains, 'LHB')}</a></td>
                <td class="irf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('irf_reg', 'mis_link_g_loco_icf')" aria-label="View IRF Regular Mis Link from G_loco ICF">${countMisLinkGLoco(irfRegTrains, 'ICF')}</a></td>
                <td class="irf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('irf_tod', 'mis_link_g_loco')" aria-label="View IRF TOD Mis Link from G_loco">${countMisLinkGLoco(irfTodTrains)}</a></td>
                <td class="irf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('irf_tod', 'mis_link_g_loco_lhb')" aria-label="View IRF TOD Mis Link from G_loco LHB">${countMisLinkGLoco(irfTodTrains, 'LHB')}</a></td>
                <td class="irf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('irf_tod', 'mis_link_g_loco_icf')" aria-label="View IRF TOD Mis Link from G_loco ICF">${countMisLinkGLoco(irfTodTrains, 'ICF')}</a></td>
            </tr>
        `;
    };

    const renderMisHOGGLocoRow = () => {
        return `
            <tr class="mis-row">
                <td>Mis HOG from G_loco</td>
                <td class="trf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('trf_reg', 'mis_hog_g_loco')" aria-label="View TRF Regular Mis HOG from G_loco">${countMisHOGGLoco(trfRegTrains)}</a></td>
                <td class="trf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('trf_reg', 'mis_hog_g_loco_lhb')" aria-label="View TRF Regular Mis HOG from G_loco LHB">${countMisHOGGLoco(trfRegTrains, 'LHB')}</a></td>
                <td class="trf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('trf_reg', 'mis_hog_g_loco_icf')" aria-label="View TRF Regular Mis HOG from G_loco ICF">${countMisHOGGLoco(trfRegTrains, 'ICF')}</a></td>
                <td class="trf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('trf_tod', 'mis_hog_g_loco')" aria-label="View TRF TOD Mis HOG from G_loco">${countMisHOGGLoco(trfTodTrains)}</a></td>
                <td class="trf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('trf_tod', 'mis_hog_g_loco_lhb')" aria-label="View TRF TOD Mis HOG from G_loco LHB">${countMisHOGGLoco(trfTodTrains, 'LHB')}</a></td>
                <td class="trf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('trf_tod', 'mis_hog_g_loco_icf')" aria-label="View TRF TOD Mis HOG from G_loco ICF">${countMisHOGGLoco(trfTodTrains, 'ICF')}</a></td>
                <td class="irf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('irf_reg', 'mis_hog_g_loco')" aria-label="View IRF Regular Mis HOG from G_loco">${countMisHOGGLoco(irfRegTrains)}</a></td>
                <td class="irf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('irf_reg', 'mis_hog_g_loco_lhb')" aria-label="View IRF Regular Mis HOG from G_loco LHB">${countMisHOGGLoco(irfRegTrains, 'LHB')}</a></td>
                <td class="irf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('irf_reg', 'mis_hog_g_loco_icf')" aria-label="View IRF Regular Mis HOG from G_loco ICF">${countMisHOGGLoco(irfRegTrains, 'ICF')}</a></td>
                <td class="irf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('irf_tod', 'mis_hog_g_loco')" aria-label="View IRF TOD Mis HOG from G_loco">${countMisHOGGLoco(irfTodTrains)}</a></td>
                <td class="irf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('irf_tod', 'mis_hog_g_loco_lhb')" aria-label="View IRF TOD Mis HOG from G_loco LHB">${countMisHOGGLoco(irfTodTrains, 'LHB')}</a></td>
                <td class="trf-cell highlight-red"><a href="#" onclick="event.preventDefault();showPopup('irf_tod', 'mis_hog_g_loco_icf')" aria-label="View IRF TOD Mis HOG from G_loco ICF">${countMisHOGGLoco(irfTodTrains, 'ICF')}</a></td>
            </tr>
        `;
    };

    document.getElementById('trainSummaryTable').innerHTML = `
        <div class="summary-stack">
            <div class="summary-section">
                <h3>Train Summary</h3>
                <table>
                    <thead>
                        <tr>
                            <th rowspan="2">Details</th>
                            <th colspan="3" class="trf-header">Outgoing (TRF) Regular</th>
                            <th colspan="3" class="trf-header">Outgoing (TRF) TOD</th>
                            <th colspan="3" class="irf-header">Incoming (IRF) Regular</th>
                            <th colspan="3" class="irf-header">Incoming (IRF) TOD</th>
                        </tr>
                        <tr>
                            <th class="trf-header">Total</th><th class="trf-header">LHB</th><th class="trf-header">ICF</th>
                            <th class="trf-header">Total</th><th class="trf-header">LHB</th><th class="trf-header">ICF</th>
                            <th class="irf-header">Total</th><th class="irf-header">LHB</th><th class="irf-header">ICF</th>
                            <th class="irf-header">Total</th><th class="irf-header">LHB</th><th class="irf-header">ICF</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Total Trains</td>
                            <td class="trf-cell"><a href="#" onclick="event.preventDefault();showPopup('trf_reg', 'total')" aria-label="View TRF Regular Total">${countByStatus(trfRegTrains, () => 'total', 'total')}</a></td>
                            <td class="trf-cell"><a href="#" onclick="event.preventDefault();showPopup('trf_reg', 'lhb')" aria-label="View TRF Regular LHB">${countByStatus(trfRegTrains, () => 'total', 'total', 'LHB')}</a></td>
                            <td class="trf-cell"><a href="#" onclick="event.preventDefault();showPopup('trf_reg', 'icf')" aria-label="View TRF Regular ICF">${countByStatus(trfRegTrains, () => 'total', 'total', 'ICF')}</a></td>
                            <td class="trf-cell"><a href="#" onclick="event.preventDefault();showPopup('trf_tod', 'total')" aria-label="View TRF TOD Total">${countByStatus(trfTodTrains, () => 'total', 'total')}</a></td>
                            <td class="trf-cell"><a href="#" onclick="event.preventDefault();showPopup('trf_tod', 'lhb')" aria-label="View TRF TOD LHB">${countByStatus(trfTodTrains, () => 'total', 'total', 'LHB')}</a></td>
                            <td class="trf-cell"><a href="#" onclick="event.preventDefault();showPopup('trf_tod', 'icf')" aria-label="View TRF TOD ICF">${countByStatus(trfTodTrains, () => 'total', 'total', 'ICF')}</a></td>
                            <td class="irf-cell"><a href="#" onclick="event.preventDefault();showPopup('irf_reg', 'total')" aria-label="View IRF Regular Total">${countByStatus(irfRegTrains, () => 'total', 'total')}</a></td>
                            <td class="irf-cell"><a href="#" onclick="event.preventDefault();showPopup('irf_reg', 'lhb')" aria-label="View IRF Regular LHB">${countByStatus(irfRegTrains, () => 'total', 'total', 'LHB')}</a></td>
                            <td class="irf-cell"><a href="#" onclick="event.preventDefault();showPopup('irf_reg', 'icf')" aria-label="View IRF Regular ICF">${countByStatus(irfRegTrains, () => 'total', 'total', 'ICF')}</a></td>
                            <td class="irf-cell"><a href="#" onclick="event.preventDefault();showPopup('irf_tod', 'total')" aria-label="View IRF TOD Total">${countByStatus(irfTodTrains, () => 'total', 'total')}</a></td>
                            <td class="irf-cell"><a href="#" onclick="event.preventDefault();showPopup('irf_tod', 'lhb')" aria-label="View IRF TOD LHB">${countByStatus(irfTodTrains, () => 'total', 'total', 'LHB')}</a></td>
                            <td class="irf-cell"><a href="#" onclick="event.preventDefault();showPopup('irf_tod', 'icf')" aria-label="View IRF TOD ICF">${countByStatus(irfTodTrains, () => 'total', 'total', 'ICF')}</a></td>
                        </tr>
                        ${renderSummaryRow('Link', 'link', 'link')}
                        ${renderSummaryRow('Mis Link', 'mis_link', 'link', true)}
                        ${renderMisLinkGLocoRow()}
                        ${renderSummaryRow('FR Link', 'FR_link', 'link')}
                        ${renderSummaryRow('FR Link_WR', 'FR_link_WR', 'link')}
                        ${renderSummaryRow('Mis HOG', 'Mis_HOG', 'hog', true)}
                        ${renderMisHOGGLocoRow()}
                        ${renderSummaryRow('HOG Right', 'HOG_Right', 'hog')}
                        ${renderSummaryRow('Not Req HOG', 'Not Req_HOG', 'hog')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

const showPopup = (type, filter) => {
    let filteredTrfData = applyFilters(trfData);
    let filteredIrfData = applyFilters(irfData);

    const filters = {
        'trf_reg': row => !row[4]?.toLowerCase().includes('tod'),
        'trf_tod': row => row[4]?.toLowerCase().includes('tod'),
        'irf_reg': row => !row[4]?.toLowerCase().includes('tod'),
        'irf_tod': row => row[4]?.toLowerCase().includes('tod')
    };

    if (type.startsWith('trf_')) {
        filteredIrfData = [];
        if (filters[type]) filteredTrfData = filteredTrfData.filter(filters[type]);
    } else if (type.startsWith('irf_')) {
        filteredTrfData = [];
        if (filters[type]) filteredIrfData = filteredIrfData.filter(filters[type]);
    }

    if (filter === 'total') {
        // No additional filter
    } else if (filter === 'lhb') {
        filteredTrfData = filteredTrfData.filter(row => row[8]?.toUpperCase().includes('LHB'));
        filteredIrfData = filteredIrfData.filter(row => row[8]?.toUpperCase().includes('LHB'));
    } else if (filter === 'icf') {
        filteredTrfData = filteredTrfData.filter(row => row[8]?.toUpperCase().includes('ICF'));
        filteredIrfData = filteredIrfData.filter(row => row[8]?.toUpperCase().includes('ICF'));
    } else if (filter === 'link') {
        filteredTrfData = filteredTrfData.filter(row => getLinkStatus(row) === 'link');
        filteredIrfData = filteredIrfData.filter(row => getLinkStatus(row) === 'link');
    } else if (filter === 'mis_link') {
        filteredTrfData = filteredTrfData.filter(row => getLinkStatus(row) === 'mis_link');
        filteredIrfData = filteredIrfData.filter(row => getLinkStatus(row) === 'mis_link');
    } else if (filter === 'mis_link_g_loco') {
        filteredTrfData = filteredTrfData.filter(row => getLinkStatus(row) === 'mis_link' && isGLoco(row));
        filteredIrfData = filteredIrfData.filter(row => getLinkStatus(row) === 'mis_link' && isGLoco(row));
    } else if (filter === 'FR_link') {
        filteredTrfData = filteredTrfData.filter(row => getLinkStatus(row) === 'FR_link');
        filteredIrfData = filteredIrfData.filter(row => getLinkStatus(row) === 'FR_link');
    } else if (filter === 'FR_link_WR') {
        filteredTrfData = filteredTrfData.filter(row => getLinkStatus(row) === 'FR_link_WR');
        filteredIrfData = filteredIrfData.filter(row => getLinkStatus(row) === 'FR_link_WR');
    } else if (filter === 'Mis_HOG') {
        filteredTrfData = filteredTrfData.filter(row => getHOGStatus(row) === 'Mis_HOG');
        filteredIrfData = filteredIrfData.filter(row => getHOGStatus(row) === 'Mis_HOG');
    } else if (filter === 'mis_hog_g_loco') {
        filteredTrfData = filteredTrfData.filter(row => getHOGStatus(row) === 'Mis_HOG' && isGLoco(row));
        filteredIrfData = filteredIrfData.filter(row => getHOGStatus(row) === 'Mis_HOG' && isGLoco(row));
    } else if (filter === 'HOG_Right') {
        filteredTrfData = filteredTrfData.filter(row => getHOGStatus(row) === 'HOG_Right');
        filteredIrfData = filteredIrfData.filter(row => getHOGStatus(row) === 'HOG_Right');
    } else if (filter === 'Not Req_HOG') {
        filteredTrfData = filteredTrfData.filter(row => getHOGStatus(row) === 'Not Req_HOG');
        filteredIrfData = filteredIrfData.filter(row => getHOGStatus(row) === 'Not Req_HOG');
    } else if (filter.endsWith('_lhb')) {
        const status = filter.replace('_lhb', '');
        if (status === 'mis_link_g_loco') {
            filteredTrfData = filteredTrfData.filter(row => getLinkStatus(row) === 'mis_link' && isGLoco(row) && row[8]?.toUpperCase().includes('LHB'));
            filteredIrfData = filteredIrfData.filter(row => getLinkStatus(row) === 'mis_link' && isGLoco(row) && row[8]?.toUpperCase().includes('LHB'));
        } else if (status === 'mis_hog_g_loco') {
            filteredTrfData = filteredTrfData.filter(row => getHOGStatus(row) === 'Mis_HOG' && isGLoco(row) && row[8]?.toUpperCase().includes('LHB'));
            filteredIrfData = filteredIrfData.filter(row => getHOGStatus(row) === 'Mis_HOG' && isGLoco(row) && row[8]?.toUpperCase().includes('LHB'));
        } else {
            filteredTrfData = filteredTrfData.filter(row => (status === 'total' || (status === 'link' ? getLinkStatus(row) : getHOGStatus(row)) === status) && row[8]?.toUpperCase().includes('LHB'));
            filteredIrfData = filteredIrfData.filter(row => (status === 'total' || (status === 'link' ? getLinkStatus(row) : getHOGStatus(row)) === status) && row[8]?.toUpperCase().includes('LHB'));
        }
    } else if (filter.endsWith('_icf')) {
        const status = filter.replace('_icf', '');
        if (status === 'mis_link_g_loco') {
            filteredTrfData = filteredTrfData.filter(row => getLinkStatus(row) === 'mis_link' && isGLoco(row) && row[8]?.toUpperCase().includes('ICF'));
            filteredIrfData = filteredIrfData.filter(row => getLinkStatus(row) === 'mis_link' && isGLoco(row) && row[8]?.toUpperCase().includes('ICF'));
        } else if (status === 'mis_hog_g_loco') {
            filteredTrfData = filteredTrfData.filter(row => getHOGStatus(row) === 'Mis_HOG' && isGLoco(row) && row[8]?.toUpperCase().includes('ICF'));
            filteredIrfData = filteredIrfData.filter(row => getHOGStatus(row) === 'Mis_HOG' && isGLoco(row) && row[8]?.toUpperCase().includes('ICF'));
        } else {
            filteredTrfData = filteredTrfData.filter(row => (status === 'total' || (status === 'link' ? getLinkStatus(row) : getHOGStatus(row)) === status) && row[8]?.toUpperCase().includes('ICF'));
            filteredIrfData = filteredIrfData.filter(row => (status === 'total' || (status === 'link' ? getLinkStatus(row) : getHOGStatus(row)) === status) && row[8]?.toUpperCase().includes('ICF'));
        }
    }

    const combinedData = [
        ...filteredTrfData.map(row => ({ sheet: 'TRF', row })),
        ...filteredIrfData.map(row => ({ sheet: 'IRF', row }))
    ].sort((a, b) => {
        const dateA = parseDate(a.row[33]) || new Date(0);
        const dateB = parseDate(b.row[33]) || new Date(0);
        return dateB - dateA;
    });

    renderPopupTable(combinedData);
    document.getElementById('combinedPopup').classList.add('show');
    document.getElementById('popupOverlay').classList.add('show');
};

const showPopupWithDivision = (sheet, status, division) => {
    let filteredTrfData = applyFilters(trfData);
    let filteredIrfData = applyFilters(irfData);

    if (sheet === 'trf') {
        filteredIrfData = [];
        filteredTrfData = filteredTrfData.filter(row => row[0]?.trim().toUpperCase() === division);
        if (status === 'mis_link') {
            filteredTrfData = filteredTrfData.filter(row => getLinkStatus(row) === 'mis_link');
        } else if (status === 'mis_hog') {
            filteredTrfData = filteredTrfData.filter(row => getHOGStatus(row) === 'Mis_HOG');
        }
    } else if (sheet === 'irf') {
        filteredTrfData = [];
        filteredIrfData = filteredIrfData.filter(row => row[0]?.trim().toUpperCase() === division);
        if (status === 'mis_link') {
            filteredIrfData = filteredIrfData.filter(row => getLinkStatus(row) === 'mis_link');
        } else if (status === 'mis_hog') {
            filteredIrfData = filteredIrfData.filter(row => getHOGStatus(row) === 'Mis_HOG');
        }
    }

    const combinedData = [
        ...filteredTrfData.map(row => ({ sheet: 'TRF', row })),
        ...filteredIrfData.map(row => ({ sheet: 'IRF', row }))
    ].sort((a, b) => {
        const dateA = parseDate(a.row[33]) || new Date(0);
        const dateB = parseDate(b.row[33]) || new Date(0);
        return dateB - dateA;
    });

    renderPopupTable(combinedData);
    document.getElementById('combinedPopup').classList.add('show');
    document.getElementById('popupOverlay').classList.add('show');
};

const showHoverPopup = (event, sheet, status, division) => {
    let filteredTrfData = applyFilters(trfData);
    let filteredIrfData = applyFilters(irfData);

    if (sheet === 'trf') {
        filteredIrfData = [];
        filteredTrfData = filteredTrfData.filter(row => row[0]?.trim().toUpperCase() === division);
        if (status === 'mis_link') {
            filteredTrfData = filteredTrfData.filter(row => getLinkStatus(row) === 'mis_link');
        } else if (status === 'mis_hog') {
            filteredTrfData = filteredTrfData.filter(row => getHOGStatus(row) === 'Mis_HOG');
        }
    } else if (sheet === 'irf') {
        filteredTrfData = [];
        filteredIrfData = filteredIrfData.filter(row => row[0]?.trim().toUpperCase() === division);
        if (status === 'mis_link') {
            filteredIrfData = filteredIrfData.filter(row => getLinkStatus(row) === 'mis_link');
        } else if (status === 'mis_hog') {
            filteredIrfData = filteredIrfData.filter(row => getHOGStatus(row) === 'Mis_HOG');
        }
    }

    const combinedData = [
        ...filteredTrfData.map(row => ({ sheet: 'TRF', row })),
        ...filteredIrfData.map(row => ({ sheet: 'IRF', row }))
    ].sort((a, b) => {
        const dateA = parseDate(a.row[33]) || new Date(0);
        const dateB = parseDate(b.row[33]) || new Date(0);
        return dateB - dateA;
    }).slice(0, 20) // Limit to top 20 rows

    const headers = ['Div.', 'Train No.', 'Loco','Rake', 'Link', 'HOG'];
    const cols = [0, 2, 12, 8];
    let html = `<table><tr>${headers.map(h => `<th scope="col">${sanitizeHTML(h)}</th>`).join('')}</tr>`;
    combinedData.forEach(({ sheet, row }) => {
        const rowClass = sheet === 'TRF' ? 'trf-row' : 'irf-row';
        html += `<tr class="${rowClass}">`;
        cols.forEach(col => {
            const value = row[col] ?? 'N/A';
            html += `<td>${sanitizeHTML(value)}</td>`;
        });
        const linkStatus = getLinkStatus(row);
        const hogStatus = getHOGStatus(row);
        html += `<td class="${linkStatus === 'mis_link' ? 'highlight-red' : ''}">${sanitizeHTML(linkStatus)}</td>`;
        html += `<td class="${hogStatus === 'Mis_HOG' ? 'highlight-red' : ''}">${sanitizeHTML(hogStatus)}</td>`;
        html += '</tr>';
    });
    html += '</table>';

    const hoverPopup = document.getElementById('hoverPopup');
    hoverPopup.innerHTML = html || '<p>No data found.</p>';
    hoverPopup.classList.add('show');

    const x = event.clientX + 10;
    const y = event.clientY + 10;
    const maxX = window.innerWidth - 310; // 300px width + 10px margin
    const maxY = window.innerHeight - 210; // 200px height + 10px margin
    hoverPopup.style.left = `${Math.min(x, maxX)}px`;
    hoverPopup.style.top = `${Math.min(y, maxY)}px`;
};

const hideHoverPopup = () => {
    const hoverPopup = document.getElementById('hoverPopup');
    hoverPopup.classList.remove('show');
};

const renderPopupTable = (data) => {
    const headers = [
        'Div.', 'Train No.', 'Train Type', 'Rake Type LHB / ICF', 'Loco Link of Shed',
        'Loco Link of Rly', 'As per loco link Provision of HOG Loco Y / N', 'Working Loco',
        'HOME SHED', 'Owning Rly.', 'TYPE OF LOCO', 'LOCO HOG/ NON HOG',
        'Reason for not providing HOG loco, if planned in link', 'HOG Wkg / Not Wkg YES OR NO',
        'Link Status', 'HOG Status'
    ];
    const cols = [0, 2, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

    let html = `<tr><th scope="col">Sr. No.</th>${headers.map(h => `<th scope="col">${sanitizeHTML(h)}</th>`).join('')}</tr>`;
    data.forEach(({ sheet, row }, i) => {
        const rowClass = sheet === 'TRF' ? 'trf-row' : 'irf-row';
        html += `<tr class="${rowClass}"><td>${i + 1}</td>`;
        cols.forEach(col => {
            const value = row[col] ?? 'N/A';
            html += `<td>${sanitizeHTML(value)}</td>`;
        });
        const linkStatus = getLinkStatus(row);
        const hogStatus = getHOGStatus(row);
        html += `<td class="${linkStatus === 'mis_link' ? 'highlight-red' : ''}">${sanitizeHTML(linkStatus)}</td>`;
        html += `<td class="${hogStatus === 'Mis_HOG' ? 'highlight-red' : ''}">${sanitizeHTML(hogStatus)}</td>`;
        html += '</tr>';
    });

    document.getElementById('combinedPopupTable').innerHTML = html || `<tr><td colspan="${headers.length + 1}">No data found.</td></tr>`;
};

const closePopup = () => {
    document.getElementById('combinedPopup').classList.remove('show');
    document.getElementById('popupOverlay').classList.remove('show');
};

// --- Remove MIS LINK, MIS HOG popup logic and event listeners ---
// Remove: showMisLinkPopup, showMisHOGPopup, setPopupDefaultDates, getLastNDates, misLinkChartInstance, misHOGChartInstance, and related event listeners

// --- Add MIS LINK and MIS HOG to Quick Reports ---
document.addEventListener('DOMContentLoaded', function() {
    // --- Dynamic Report Buttons
    const reportButtons = document.getElementById('reportButtons');
    // 10 working Quick Reports + MIS LINK + MIS HOG
    const reportNames = [
        'Division Wise',
        'Link Status',
        'Origin-Destination',
        'Link Trends',
        'HOG Performance',
        'Top Links',
        'Train Type Wise',
        'Loco Wise',
        'Cancelled Trains',
        'Monthly Trends',
        'MIS LINK',
        'MIS HOG'
    ];
    reportNames.forEach((name, idx) => {
        const btn = document.createElement('button');
        btn.className = 'report-btn';
        btn.innerText = name;
        btn.addEventListener('click', function() {
            showReport(name);
        });
        reportButtons.appendChild(btn);
    });

    // --- Add quick date button next to date fields ---
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    if (startDateInput && endDateInput) {
        // Create the button
        const quickBtn = document.createElement('button');
        quickBtn.type = 'button';
        quickBtn.textContent = 'Set Last 2 Days';
        quickBtn.style.marginLeft = '8px';
        quickBtn.style.padding = '2px 10px';
        quickBtn.style.fontSize = '0.95em';
        quickBtn.title = 'Set Start/End date to last 2 days';

        quickBtn.addEventListener('click', function() {
            setDefaultDates();
            fetchData();
        });

        // Insert after endDate input
        endDateInput.parentNode.insertBefore(quickBtn, endDateInput.nextSibling);
    }
});

// --- Report Popup Logic ---
function showReport(reportType) {
    const popup = document.getElementById('reportPopup');
    const overlay = document.getElementById('reportPopupOverlay');
    const content = document.getElementById('reportPopupContent');
    const title = document.getElementById('reportPopupTitle');
    title.innerText = reportType;
    content.innerHTML = '<div>Loading...</div>';
    popup.classList.add('show');
    overlay.classList.add('show');

    setTimeout(() => {
        let html = '';
        let chartId = 'reportChart_' + Math.random().toString(36).substr(2, 5);
        let chartData = null;
        let chartType = 'bar';
        let chartOptions = {};
        // Helper: count by a column
        function countByCol(data, colIdx) {
            const counts = {};
            data.forEach(row => {
                const key = (row[colIdx] || '').trim();
                if (key) counts[key] = (counts[key] || 0) + 1;
            });
            return counts;
        }
        // Helper: top pairs
        function countPairs(data, colA, colB) {
            const counts = {};
            data.forEach(row => {
                const key = (row[colA] || '').trim() + ' → ' + (row[colB] || '').trim();
                if (key.includes('→')) counts[key] = (counts[key] || 0) + 1;
            });
            return counts;
        }
        // Helper: link status
        function countLinkStatus(data) {
            const counts = {};
            data.forEach(row => {
                const status = getLinkStatus(row);
                counts[status] = (counts[status] || 0) + 1;
            });
            return counts;
        }
        // Helper: HOG status
        function countHOGStatus(data) {
            const counts = {};
            data.forEach(row => {
                const status = getHOGStatus(row);
                counts[status] = (counts[status] || 0) + 1;
            });
            return counts;
        }
        // Helper: link trends by date
        function linkTrends(data) {
            const trends = {};
            data.forEach(row => {
                const date = row[33];
                const status = getLinkStatus(row);
                if (!date) return;
                if (!trends[date]) trends[date] = { link: 0, mis_link: 0, total: 0 };
                if (status === 'link') trends[date].link++;
                if (status === 'mis_link') trends[date].mis_link++;
                trends[date].total++;
            });
            return trends;
        }
        // Helper: filter by date
        function filterByDate(data) {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            if (!startDate || !endDate) return data;
            const start = new Date(startDate);
            const end = new Date(endDate);
            return data.filter(row => {
                const d = row[33];
                if (!d) return false;
                const dt = new Date(d);
                return dt >= start && dt <= end;
            });
        }
        // --- Report logic ---
        // Split TRF & IRF for all quick reports
        let trfOnly = filterByDate(trfData.slice(1));
        let irfOnly = filterByDate(irfData.slice(1));
        let allData = [...trfOnly, ...irfOnly];
        if (reportType === 'Division Wise') {
            const counts = countByCol(allData, 0);
            html += '<table><tr><th>Division</th><th>Count</th></tr>';
            Object.entries(counts).forEach(([div, cnt]) => {
                html += `<tr><td>${sanitizeHTML(div)}</td><td>${cnt}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: Object.keys(counts),
                datasets: [{ label: 'Trains', data: Object.values(counts), backgroundColor: '#00b4d8' }]
            };
            chartType = 'bar';
        } else if (reportType === 'Link Status') {
            const countsTRF = countLinkStatus(trfOnly);
            const countsIRF = countLinkStatus(irfOnly);
            const allStatuses = Array.from(new Set([...Object.keys(countsTRF), ...Object.keys(countsIRF)]));
            html += '<table><tr><th>Status</th><th>TRF Count</th><th>IRF Count</th></tr>';
            allStatuses.forEach(status => {
                html += `<tr><td>${sanitizeHTML(status)}</td><td>${countsTRF[status]||0}</td><td>${countsIRF[status]||0}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: allStatuses,
                datasets: [
                  { label: 'TRF', data: allStatuses.map(s=>countsTRF[s]||0), backgroundColor: '#00b4d8' },
                  { label: 'IRF', data: allStatuses.map(s=>countsIRF[s]||0), backgroundColor: '#ff595e' }
                ]
            };
            chartType = 'bar';
        } else if (reportType === 'Origin-Destination') {
            const counts = countPairs(allData, 5, 6); // F (5) = Origin, G (6) = Dest
            const topPairs = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 10);
            html += '<table><tr><th>Origin → Destination</th><th>Count</th></tr>';
            topPairs.forEach(([pair, cnt]) => {
                html += `<tr><td>${sanitizeHTML(pair)}</td><td>${cnt}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: topPairs.map(x=>x[0]),
                datasets: [{ label: 'Count', data: topPairs.map(x=>x[1]), backgroundColor: '#00b4d8' }]
            };
            chartType = 'bar';
        } else if (reportType === 'Link Trends') {
            // Split trends by TRF/IRF
            function linkTrendsBySheet(data, sheetLabel) {
                const trends = {};
                data.forEach(row => {
                    const date = row[33];
                    const status = getLinkStatus(row);
                    if (!date) return;
                    if (!trends[date]) trends[date] = { link: 0, mis_link: 0, total: 0 };
                    if (status === 'link') trends[date].link++;
                    if (status === 'mis_link') trends[date].mis_link++;
                    trends[date].total++;
                });
                return trends;
            }
            const trendsTRF = linkTrendsBySheet(trfOnly, 'TRF');
            const trendsIRF = linkTrendsBySheet(irfOnly, 'IRF');
            const allDates = Array.from(new Set([...Object.keys(trendsTRF), ...Object.keys(trendsIRF)])).sort();
            html += '<table><tr><th>Date</th><th>TRF Link</th><th>TRF Mis Link</th><th>IRF Link</th><th>IRF Mis Link</th></tr>';
            allDates.forEach(date => {
                html += `<tr><td>${sanitizeHTML(date)}</td><td>${trendsTRF[date]?.link||0}</td><td>${trendsTRF[date]?.mis_link||0}</td><td>${trendsIRF[date]?.link||0}</td><td>${trendsIRF[date]?.mis_link||0}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: allDates,
                datasets: [
                    { label: 'TRF Link', data: allDates.map(d=>trendsTRF[d]?.link||0), borderColor: '#198754', backgroundColor: 'rgba(25,135,84,0.2)', type: 'line', fill: false },
                    { label: 'Outgoing train Mis Link', data: allDates.map(d=>trendsTRF[d]?.mis_link||0), borderColor: '#ff595e', backgroundColor: 'rgba(255,89,94,0.2)', type: 'line', fill: false },
                    { label: 'IRF Link', data: allDates.map(d=>trendsIRF[d]?.link||0), borderColor: '#00b4d8', backgroundColor: 'rgba(0,180,216,0.2)', type: 'line', fill: false },
                    { label: 'IRF Mis Link', data: allDates.map(d=>trendsIRF[d]?.mis_link||0), borderColor: '#ffc300', backgroundColor: 'rgba(255,195,0,0.2)', type: 'line', fill: false }
                ]
            };
            chartType = 'line';
        } else if (reportType === 'HOG Performance') {
            const counts = countHOGStatus(allData);
            html += '<table><tr><th>HOG Status</th><th>Count</th></tr>';
            Object.entries(counts).forEach(([status, cnt]) => {
                html += `<tr><td>${sanitizeHTML(status)}</td><td>${cnt}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: Object.keys(counts),
                datasets: [{ label: 'Count', data: Object.values(counts), backgroundColor: ['#00b4d8','#ff595e','#198754','#ffc300','#6c757d'] }]
            };
            chartType = 'pie';
        } else if (reportType === 'Top Links') {
            const counts = countByCol(allData, 37); // AL (37) = Link
            const topLinks = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 10);
            html += '<table><tr><th>Link</th><th>Count</th></tr>';
            topLinks.forEach(([link, cnt]) => {
                html += `<tr><td>${sanitizeHTML(link)}</td><td>${cnt}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: topLinks.map(x=>x[0]),
                datasets: [{ label: 'Count', data: topLinks.map(x=>x[1]), backgroundColor: '#00b4d8' }]
            };
            chartType = 'bar';
        } else if (reportType === 'Train Type Wise') {
            const counts = countByCol(allData, 2); // C (2) = Train Type
            html += '<table><tr><th>Train Type</th><th>Count</th></tr>';
            Object.entries(counts).forEach(([type, cnt]) => {
                html += `<tr><td>${sanitizeHTML(type)}</td><td>${cnt}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: Object.keys(counts),
                datasets: [{ label: 'Count', data: Object.values(counts), backgroundColor: '#00b4d8' }]
            };
            chartType = 'bar';
        } else if (reportType === 'Loco Wise') {
            const counts = countByCol(allData, 12); // M (12) = Loco
            html += '<table><tr><th>Loco</th><th>Count</th></tr>';
            Object.entries(counts).forEach(([loco, cnt]) => {
                html += `<tr><td>${sanitizeHTML(loco)}</td><td>${cnt}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: Object.keys(counts),
                datasets: [{ label: 'Count', data: Object.values(counts), backgroundColor: '#00b4d8' }]
            };
            chartType = 'bar';
        } else if (reportType === 'Cancelled Trains') {
            // Try to find cancelled trains (if a column indicates cancellation)
            // For now, assume Col AH (33) = Date, Col AK (36) = Cancelled (Y/N or similar)
            const cancelled = allData.filter(row => (row[36] || '').toLowerCase().includes('y'));
            html += `<div style="font-size:1.15em;">Total Cancelled Trains: <b>${cancelled.length}</b></div>`;
            if (cancelled.length) {
                html += '<table><tr><th>Train No.</th><th>Date</th><th>Division</th></tr>';
                cancelled.forEach(row => {
                    html += `<tr><td>${sanitizeHTML(row[2])}</td><td>${sanitizeHTML(row[33])}</td><td>${sanitizeHTML(row[0])}</td></tr>`;
                });
                html += '</table>';
            }
            chartData = {
                labels: ['Cancelled','Active'],
                datasets: [{ label: 'Trains', data: [cancelled.length, allData.length-cancelled.length], backgroundColor: ['#ff595e','#00b4d8'] }]
            };
            chartType = 'doughnut';
        } else if (reportType === 'Monthly Trends') {
            // Group by month
            const monthly = {};
            allData.forEach(row => {
                const d = row[33];
                if (!d) return;
                const dt = new Date(d);
                const key = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0');
                if (!monthly[key]) monthly[key] = 0;
                monthly[key]++;
            });
            const months = Object.keys(monthly).sort();
            html += '<table><tr><th>Month</th><th>Count</th></tr>';
            months.forEach(m => {
                html += `<tr><td>${sanitizeHTML(m)}</td><td>${monthly[m]}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: months,
                datasets: [{ label: 'Trains', data: months.map(m=>monthly[m]), backgroundColor: '#00b4d8' }]
            };
            chartType = 'bar';
        } else if (reportType === 'MIS LINK' || reportType === 'MIS HOG') {
            // --- MIS LINK and MIS HOG Quick Reports: Use Train Summary logic for table ---
            // Get last 15 days
            function getLastNDates(n) {
                const arr = [];
                const today = new Date();
                today.setDate(today.getDate() - 1);
                for (let i = n - 1; i >= 0; i--) {
                    const d = new Date(today);
                    d.setDate(today.getDate() - i);
                    arr.push(formatDate(d));
                }
                return arr;
            }
            // Default: last 2 dates (yesterday and day before)
            const last2 = getLastNDates(2);
            const last15 = getLastNDates(15);

            // Filter rows for last 15 days
            function filterRows(data, statusFn, status, dateArr) {
                return data.slice(1).filter(row => {
                    const d = row[33];
                    if (!d) return false;
                    const dt = formatDate(new Date(d));
                    return statusFn(row) === status && dateArr.includes(dt);
                });
            }
            let label, statusFn, status;
            if (reportType === 'MIS LINK') {
                label = 'Mis Link';
                statusFn = getLinkStatus;
                status = 'mis_link';
            } else {
                label = 'Mis HOG';
                statusFn = getHOGStatus;
                status = 'Mis_HOG';
            }
            // Prepare filtered data for summary (last 15 for chart, last 2 for table)
            const trfRows15 = filterRows(trfData, statusFn, status, last15);
            const irfRows15 = filterRows(irfData, statusFn, status, last15);
            const trfRows2 = filterRows(trfData, statusFn, status, last2);
            const irfRows2 = filterRows(irfData, statusFn, status, last2);

            // Helper for LHB/ICF
            const isLHB = row => row[8]?.toUpperCase().includes('LHB');
            const isICF = row => row[8]?.toUpperCase().includes('ICF');
            // Helper for TOD
            const isTOD = row => row[4]?.toLowerCase().includes('tod');

            // Split by regular/TOD for last 2 days
            function splitByType(rows) {
                return {
                    reg: rows.filter(row => !isTOD(row)),
                    tod: rows.filter(isTOD)
                };
            }
            const trf2 = splitByType(trfRows2);
            const irf2 = splitByType(irfRows2);

            // Table for last 2 days, date-wise, bifurcated TRF/IRF
            function renderDatewiseTable(rows, label) {
                // Group by date
                const byDate = {};
                rows.forEach(row => {
                    const d = formatDate(new Date(row[33]));
                    if (!byDate[d]) byDate[d] = [];
                    byDate[d].push(row);
                });
                let out = `<table class="universal-table"><thead><tr><th>Date</th><th>Train No.</th><th>Division</th><th>Rake</th><th>Loco</th></tr></thead><tbody>`;
                Object.keys(byDate).sort().forEach(date => {
                    byDate[date].forEach((row, idx) => {
                        out += `<tr>
                            <td>${idx === 0 ? sanitizeHTML(date) : ''}</td>
                            <td>${sanitizeHTML(row[2])}</td>
                            <td>${sanitizeHTML(row[0])}</td>
                            <td>${sanitizeHTML(row[8])}</td>
                            <td>${sanitizeHTML(row[12])}</td>
                        </tr>`;
                    });
                });
                if (rows.length === 0) out += `<tr><td colspan="5">No data</td></tr>`;
                out += `</tbody></table>`;
                return `<div style="margin-bottom:10px;"><b>${label}</b>${out}</div>`;
            }

            // Chart: last 15 days, TRF/IRF counts
            const trfCounts = last15.map(date =>
                trfRows15.filter(row => formatDate(new Date(row[33])) === date).length
            );
            const irfCounts = last15.map(date =>
                irfRows15.filter(row => formatDate(new Date(row[33])) === date).length
            );
            // Only line chart (no bar)
            let lineChartId = chartId + '_line';
            let lineChartData = {
                labels: last15,
                datasets: [
                    { 
                        label: 'TRF', 
                        data: trfCounts, 
                        borderColor: '#00b4d8', 
                        backgroundColor: 'rgba(0,180,216,0.08)', 
                        type: 'line', 
                        fill: false, 
                        tension: 0.2, 
                        pointRadius: 4 
                    },
                    { 
                        label: 'IRF', 
                        data: irfCounts, 
                        borderColor: '#ff595e', 
                        backgroundColor: 'rgba(255,89,94,0.08)', 
                        type: 'line', 
                        fill: false, 
                        tension: 0.2, 
                        pointRadius: 4 
                    }
                ]
            };
            let lineChartOptions = {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: label + ' (Past 15 Days)' }
                },
                scales: {
                    x: { title: { display: true, text: 'Date' } },
                    y: { title: { display: true, text: 'Count' }, beginAtZero: true }
                }
            };

            // Insert only line chart and datewise tables for TRF/IRF (last 2 days)
            html = `<div style="width:100%;max-width:100%;"><canvas id="${lineChartId}" style="width:100%;height:720px;max-width:100%;"></canvas></div>`;
            html += `<div style="margin-top:18px;"><h4>Date-wise Details (Last 2 Days)</h4>`;
            html += renderDatewiseTable(trfRows2, 'TRF');
            html += renderDatewiseTable(irfRows2, 'IRF');
            html += `</div>`;

            content.innerHTML = html;
            setTimeout(() => {
                const ctxLine = document.getElementById(lineChartId).getContext('2d');
                new Chart(ctxLine, { type: 'line', data: lineChartData, options: lineChartOptions });
            }, 100);
            return;
        }

        // Insert chart if needed
        if (chartData) {
            html = `<div style="width:100%;max-width:100%;"><canvas id="${chartId}" style="width:100%;height:720px;max-width:100%;"></canvas></div>` + html;
        }
        content.innerHTML = html;
        if (chartData) {
            setTimeout(() => {
                const ctx = document.getElementById(chartId).getContext('2d');
                new Chart(ctx, { type: chartType, data: chartData, options: chartOptions });
            }, 100);
        }
    }, 200);
}

// --- Tab Switching Logic ---
document.addEventListener('DOMContentLoaded', function() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById('tab-' + tabId).classList.add('active');
        });
    });
});

// --- Report Popup Logic ---
function closeReportPopup() {
    document.getElementById('reportPopup').classList.remove('show');
    document.getElementById('reportPopupOverlay').classList.remove('show');
}
window.closeReportPopup = closeReportPopup;

function showReport(reportType) {
    const popup = document.getElementById('reportPopup');
    const overlay = document.getElementById('reportPopupOverlay');
    const content = document.getElementById('reportPopupContent');
    const title = document.getElementById('reportPopupTitle');
    title.innerText = reportType;
    content.innerHTML = '<div>Loading...</div>';
    popup.classList.add('show');
    overlay.classList.add('show');

    setTimeout(() => {
        let html = '';
        let chartId = 'reportChart_' + Math.random().toString(36).substr(2, 5);
        let chartData = null;
        let chartType = 'bar';
        let chartOptions = {};
        // Helper: count by a column
        function countByCol(data, colIdx) {
            const counts = {};
            data.forEach(row => {
                const key = (row[colIdx] || '').trim();
                if (key) counts[key] = (counts[key] || 0) + 1;
            });
            return counts;
        }
        // Helper: top pairs
        function countPairs(data, colA, colB) {
            const counts = {};
            data.forEach(row => {
                const key = (row[colA] || '').trim() + ' → ' + (row[colB] || '').trim();
                if (key.includes('→')) counts[key] = (counts[key] || 0) + 1;
            });
            return counts;
        }
        // Helper: link status
        function countLinkStatus(data) {
            const counts = {};
            data.forEach(row => {
                const status = getLinkStatus(row);
                counts[status] = (counts[status] || 0) + 1;
            });
            return counts;
        }
        // Helper: HOG status
        function countHOGStatus(data) {
            const counts = {};
            data.forEach(row => {
                const status = getHOGStatus(row);
                counts[status] = (counts[status] || 0) + 1;
            });
            return counts;
        }
        // Helper: link trends by date
        function linkTrends(data) {
            const trends = {};
            data.forEach(row => {
                const date = row[33];
                const status = getLinkStatus(row);
                if (!date) return;
                if (!trends[date]) trends[date] = { link: 0, mis_link: 0, total: 0 };
                if (status === 'link') trends[date].link++;
                if (status === 'mis_link') trends[date].mis_link++;
                trends[date].total++;
            });
            return trends;
        }
        // Helper: filter by date
        function filterByDate(data) {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            if (!startDate || !endDate) return data;
            const start = new Date(startDate);
            const end = new Date(endDate);
            return data.filter(row => {
                const d = row[33];
                if (!d) return false;
                const dt = new Date(d);
                return dt >= start && dt <= end;
            });
        }
        // --- Report logic ---
        // Split TRF & IRF for all quick reports
        let trfOnly = filterByDate(trfData.slice(1));
        let irfOnly = filterByDate(irfData.slice(1));
        let allData = [...trfOnly, ...irfOnly];
        if (reportType === 'Division Wise') {
            const counts = countByCol(allData, 0);
            html += '<table><tr><th>Division</th><th>Count</th></tr>';
            Object.entries(counts).forEach(([div, cnt]) => {
                html += `<tr><td>${sanitizeHTML(div)}</td><td>${cnt}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: Object.keys(counts),
                datasets: [{ label: 'Trains', data: Object.values(counts), backgroundColor: '#00b4d8' }]
            };
            chartType = 'bar';
        } else if (reportType === 'Link Status') {
            const countsTRF = countLinkStatus(trfOnly);
            const countsIRF = countLinkStatus(irfOnly);
            const allStatuses = Array.from(new Set([...Object.keys(countsTRF), ...Object.keys(countsIRF)]));
            html += '<table><tr><th>Status</th><th>TRF Count</th><th>IRF Count</th></tr>';
            allStatuses.forEach(status => {
                html += `<tr><td>${sanitizeHTML(status)}</td><td>${countsTRF[status]||0}</td><td>${countsIRF[status]||0}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: allStatuses,
                datasets: [
                  { label: 'TRF', data: allStatuses.map(s=>countsTRF[s]||0), backgroundColor: '#00b4d8' },
                  { label: 'IRF', data: allStatuses.map(s=>countsIRF[s]||0), backgroundColor: '#ff595e' }
                ]
            };
            chartType = 'bar';
        } else if (reportType === 'Origin-Destination') {
            const counts = countPairs(allData, 5, 6); // F (5) = Origin, G (6) = Dest
            const topPairs = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 10);
            html += '<table><tr><th>Origin → Destination</th><th>Count</th></tr>';
            topPairs.forEach(([pair, cnt]) => {
                html += `<tr><td>${sanitizeHTML(pair)}</td><td>${cnt}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: topPairs.map(x=>x[0]),
                datasets: [{ label: 'Count', data: topPairs.map(x=>x[1]), backgroundColor: '#00b4d8' }]
            };
            chartType = 'bar';
        } else if (reportType === 'Link Trends') {
            // Split trends by TRF/IRF
            function linkTrendsBySheet(data, sheetLabel) {
                const trends = {};
                data.forEach(row => {
                    const date = row[33];
                    const status = getLinkStatus(row);
                    if (!date) return;
                    if (!trends[date]) trends[date] = { link: 0, mis_link: 0, total: 0 };
                    if (status === 'link') trends[date].link++;
                    if (status === 'mis_link') trends[date].mis_link++;
                    trends[date].total++;
                });
                return trends;
            }
            const trendsTRF = linkTrendsBySheet(trfOnly, 'TRF');
            const trendsIRF = linkTrendsBySheet(irfOnly, 'IRF');
            const allDates = Array.from(new Set([...Object.keys(trendsTRF), ...Object.keys(trendsIRF)])).sort();
            html += '<table><tr><th>Date</th><th>TRF Link</th><th>TRF Mis Link</th><th>IRF Link</th><th>IRF Mis Link</th></tr>';
            allDates.forEach(date => {
                html += `<tr><td>${sanitizeHTML(date)}</td><td>${trendsTRF[date]?.link||0}</td><td>${trendsTRF[date]?.mis_link||0}</td><td>${trendsIRF[date]?.link||0}</td><td>${trendsIRF[date]?.mis_link||0}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: allDates,
                datasets: [
                    { label: 'TRF Link', data: allDates.map(d=>trendsTRF[d]?.link||0), borderColor: '#198754', backgroundColor: 'rgba(25,135,84,0.2)', type: 'line', fill: false },
                    { label: 'Outgoing train Mis Link', data: allDates.map(d=>trendsTRF[d]?.mis_link||0), borderColor: '#ff595e', backgroundColor: 'rgba(255,89,94,0.2)', type: 'line', fill: false },
                    { label: 'IRF Link', data: allDates.map(d=>trendsIRF[d]?.link||0), borderColor: '#00b4d8', backgroundColor: 'rgba(0,180,216,0.2)', type: 'line', fill: false },
                    { label: 'IRF Mis Link', data: allDates.map(d=>trendsIRF[d]?.mis_link||0), borderColor: '#ffc300', backgroundColor: 'rgba(255,195,0,0.2)', type: 'line', fill: false }
                ]
            };
            chartType = 'line';
        } else if (reportType === 'HOG Performance') {
            const counts = countHOGStatus(allData);
            html += '<table><tr><th>HOG Status</th><th>Count</th></tr>';
            Object.entries(counts).forEach(([status, cnt]) => {
                html += `<tr><td>${sanitizeHTML(status)}</td><td>${cnt}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: Object.keys(counts),
                datasets: [{ label: 'Count', data: Object.values(counts), backgroundColor: ['#00b4d8','#ff595e','#198754','#ffc300','#6c757d'] }]
            };
            chartType = 'pie';
        } else if (reportType === 'Top Links') {
            const counts = countByCol(allData, 37); // AL (37) = Link
            const topLinks = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 10);
            html += '<table><tr><th>Link</th><th>Count</th></tr>';
            topLinks.forEach(([link, cnt]) => {
                html += `<tr><td>${sanitizeHTML(link)}</td><td>${cnt}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: topLinks.map(x=>x[0]),
                datasets: [{ label: 'Count', data: topLinks.map(x=>x[1]), backgroundColor: '#00b4d8' }]
            };
            chartType = 'bar';
        } else if (reportType === 'Train Type Wise') {
            const counts = countByCol(allData, 2); // C (2) = Train Type
            html += '<table><tr><th>Train Type</th><th>Count</th></tr>';
            Object.entries(counts).forEach(([type, cnt]) => {
                html += `<tr><td>${sanitizeHTML(type)}</td><td>${cnt}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: Object.keys(counts),
                datasets: [{ label: 'Count', data: Object.values(counts), backgroundColor: '#00b4d8' }]
            };
            chartType = 'bar';
        } else if (reportType === 'Loco Wise') {
            const counts = countByCol(allData, 12); // M (12) = Loco
            html += '<table><tr><th>Loco</th><th>Count</th></tr>';
            Object.entries(counts).forEach(([loco, cnt]) => {
                html += `<tr><td>${sanitizeHTML(loco)}</td><td>${cnt}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: Object.keys(counts),
                datasets: [{ label: 'Count', data: Object.values(counts), backgroundColor: '#00b4d8' }]
            };
            chartType = 'bar';
        } else if (reportType === 'Cancelled Trains') {
            // Try to find cancelled trains (if a column indicates cancellation)
            // For now, assume Col AH (33) = Date, Col AK (36) = Cancelled (Y/N or similar)
            const cancelled = allData.filter(row => (row[36] || '').toLowerCase().includes('y'));
            html += `<div style="font-size:1.15em;">Total Cancelled Trains: <b>${cancelled.length}</b></div>`;
            if (cancelled.length) {
                html += '<table><tr><th>Train No.</th><th>Date</th><th>Division</th></tr>';
                cancelled.forEach(row => {
                    html += `<tr><td>${sanitizeHTML(row[2])}</td><td>${sanitizeHTML(row[33])}</td><td>${sanitizeHTML(row[0])}</td></tr>`;
                });
                html += '</table>';
            }
            chartData = {
                labels: ['Cancelled','Active'],
                datasets: [{ label: 'Trains', data: [cancelled.length, allData.length-cancelled.length], backgroundColor: ['#ff595e','#00b4d8'] }]
            };
            chartType = 'doughnut';
        } else if (reportType === 'Monthly Trends') {
            // Group by month
            const monthly = {};
            allData.forEach(row => {
                const d = row[33];
                if (!d) return;
                const dt = new Date(d);
                const key = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0');
                if (!monthly[key]) monthly[key] = 0;
                monthly[key]++;
            });
            const months = Object.keys(monthly).sort();
            html += '<table><tr><th>Month</th><th>Count</th></tr>';
            months.forEach(m => {
                html += `<tr><td>${sanitizeHTML(m)}</td><td>${monthly[m]}</td></tr>`;
            });
            html += '</table>';
            chartData = {
                labels: months,
                datasets: [{ label: 'Trains', data: months.map(m=>monthly[m]), backgroundColor: '#00b4d8' }]
            };
            chartType = 'bar';
        } else if (reportType === 'MIS LINK' || reportType === 'MIS HOG') {
            // --- MIS LINK and MIS HOG Quick Reports: Use Train Summary logic for table ---
            // Get last 15 days
            function getLastNDates(n) {
                const arr = [];
                const today = new Date();
                today.setDate(today.getDate() - 1);
                for (let i = n - 1; i >= 0; i--) {
                    const d = new Date(today);
                    d.setDate(today.getDate() - i);
                    arr.push(formatDate(d));
                }
                return arr;
            }
            // Default: last 2 dates (yesterday and day before)
            const last2 = getLastNDates(2);
            const last15 = getLastNDates(15);

            // Filter rows for last 15 days
            function filterRows(data, statusFn, status, dateArr) {
                return data.slice(1).filter(row => {
                    const d = row[33];
                    if (!d) return false;
                    const dt = formatDate(new Date(d));
                    return statusFn(row) === status && dateArr.includes(dt);
                });
            }
            let label, statusFn, status;
            if (reportType === 'MIS LINK') {
                label = 'Mis Link';
                statusFn = getLinkStatus;
                status = 'mis_link';
            } else {
                label = 'Mis HOG';
                statusFn = getHOGStatus;
                status = 'Mis_HOG';
            }
            // Prepare filtered data for summary (last 15 for chart, last 2 for table)
            const trfRows15 = filterRows(trfData, statusFn, status, last15);
            const irfRows15 = filterRows(irfData, statusFn, status, last15);
            const trfRows2 = filterRows(trfData, statusFn, status, last2);
            const irfRows2 = filterRows(irfData, statusFn, status, last2);

            // Helper for LHB/ICF
            const isLHB = row => row[8]?.toUpperCase().includes('LHB');
            const isICF = row => row[8]?.toUpperCase().includes('ICF');
            // Helper for TOD
            const isTOD = row => row[4]?.toLowerCase().includes('tod');

            // Split by regular/TOD for last 2 days
            function splitByType(rows) {
                return {
                    reg: rows.filter(row => !isTOD(row)),
                    tod: rows.filter(isTOD)
                };
            }
            const trf2 = splitByType(trfRows2);
            const irf2 = splitByType(irfRows2);

            // Table for last 2 days, date-wise, bifurcated TRF/IRF
            function renderDatewiseTable(rows, label) {
                // Group by date
                const byDate = {};
                rows.forEach(row => {
                    const d = formatDate(new Date(row[33]));
                    if (!byDate[d]) byDate[d] = [];
                    byDate[d].push(row);
                });
                let out = `<table class="universal-table"><thead><tr><th>Date</th><th>Train No.</th><th>Division</th><th>Rake</th><th>Loco</th></tr></thead><tbody>`;
                Object.keys(byDate).sort().forEach(date => {
                    byDate[date].forEach((row, idx) => {
                        out += `<tr>
                            <td>${idx === 0 ? sanitizeHTML(date) : ''}</td>
                            <td>${sanitizeHTML(row[2])}</td>
                            <td>${sanitizeHTML(row[0])}</td>
                            <td>${sanitizeHTML(row[8])}</td>
                            <td>${sanitizeHTML(row[12])}</td>
                        </tr>`;
                    });
                });
                if (rows.length === 0) out += `<tr><td colspan="5">No data</td></tr>`;
                out += `</tbody></table>`;
                return `<div style="margin-bottom:10px;"><b>${label}</b>${out}</div>`;
            }

            // Chart: last 15 days, TRF/IRF counts
            const trfCounts = last15.map(date =>
                trfRows15.filter(row => formatDate(new Date(row[33])) === date).length
            );
            const irfCounts = last15.map(date =>
                irfRows15.filter(row => formatDate(new Date(row[33])) === date).length
            );
            // Only line chart (no bar)
            let lineChartId = chartId + '_line';
            let lineChartData = {
                labels: last15,
                datasets: [
                    { 
                        label: 'Outgoing train', 
                        data: trfCounts, 
                        borderColor: '#00b4d8', 
                        backgroundColor: 'rgba(0,180,216,0.08)', 
                        type: 'line', 
                        fill: false, 
                        tension: 0.2, 
                        pointRadius: 4 
                    },
                    { 
                        label: 'IRF', 
                        data: irfCounts, 
                        borderColor: '#ff595e', 
                        backgroundColor: 'rgba(255,89,94,0.08)', 
                        type: 'line', 
                        fill: false, 
                        tension: 0.2, 
                        pointRadius: 4 
                    }
                ]
            };
            let lineChartOptions = {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: label + ' (Past 15 Days)' }
                },
                scales: {
                    x: { title: { display: true, text: 'Date' } },
                    y: { title: { display: true, text: 'Count' }, beginAtZero: true }
                }
            };

            // Insert only line chart and datewise tables for Outgoing train/IRF (last 2 days)
            html = `<div style="width:100%;max-width:100%;"><canvas id="${lineChartId}" style="width:100%;height:720px;max-width:100%;"></canvas></div>`;
            html += `<div style="margin-top:18px;"><h4>Date-wise Details (Last 2 Days)</h4>`;
            html += renderDatewiseTable(trfRows2, 'Outgoing train');
            html += renderDatewiseTable(irfRows2, 'IRF');
            html += `</div>`;

            content.innerHTML = html;
            setTimeout(() => {
                const ctxLine = document.getElementById(lineChartId).getContext('2d');
                new Chart(ctxLine, { type: 'line', data: lineChartData, options: lineChartOptions });
            }, 100);
            return;
        }

        // Insert chart if needed
        if (chartData) {
            html = `<div style="width:100%;max-width:100%;"><canvas id="${chartId}" style="width:100%;height:720px;max-width:100%;"></canvas></div>` + html;
        }
        content.innerHTML = html;
        if (chartData) {
            setTimeout(() => {
                const ctx = document.getElementById(chartId).getContext('2d');
                new Chart(ctx, { type: chartType, data: chartData, options: chartOptions });
            }, 100);
        }
    }, 200);
}

// --- MIS LINK & MIS HOG POPUP LOGIC (Division filter, summary, chart, table, hover note) ---

// Utility: Get unique divisions from data
function getDivisionsFromData(data) {
    const set = new Set();
    data.slice(1).forEach(row => {
        if (row[0]) set.add(row[0].trim().toUpperCase());
    });
    return Array.from(set).sort();
}

// Utility: Format percent
function formatPercent(num, total) {
    if (!total || total === 0) return '-';
    return (num * 100 / total).toFixed(1) + '%';
}

// Populate division filters in popups
function populatePopupDivisionFilters() {
    const divisions = getDivisionsFromData([...trfData, ...irfData]);
    ['misLinkDivisionFilter', 'misHOGDivisionFilter'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = '<option value="">All Divisions</option>';
        divisions.forEach(div => {
            const opt = document.createElement('option');
            opt.value = div;
            opt.textContent = div;
            sel.appendChild(opt);
        });
        if (prev && divisions.includes(prev)) sel.value = prev;
    });
}

// Get filtered rows for MIS LINK/HOG popup
function getMisPopupRows(type, division) {
    // type: 'mis_link' or 'mis_hog'
    const statusFn = type === 'mis_link' ? getLinkStatus : getHOGStatus;
    const statusVal = type === 'mis_link' ? 'mis_link' : 'Mis_HOG';
    const filterRows = (data) => data.slice(1).filter(row => {
        if (division && row[0]?.trim().toUpperCase() !== division) return false;
        return statusFn(row) === statusVal;
    });
    return {
        trf: filterRows(trfData),
        irf: filterRows(irfData)
    };
}

// Render summary row above chart
function renderMisPopupSummary(type, division) {
    const { trf, irf } = getMisPopupRows(type, division);
    const total = trf.length + irf.length;
    return `
        <div>
            <span style="margin-right:18px;"><b>Total:</b> ${total}</span>
            <span style="color:#00b4d8;margin-right:12px;">Outgoing train: ${trf.length}</span>
            <span style="color:#ff595e;">IRF: ${irf.length}</span>
        </div>
    `;
}

// Render date-wise table below chart (figures and %)
function renderMisPopupDateTable(type, division) {
    const { trf, irf } = getMisPopupRows(type, division);
    // Group by date
    function groupByDate(rows) {
        const map = {};
        rows.forEach(row => {
            const d = row[33] ? formatDate(new Date(row[33])) : '';
            if (!d) return;
            if (!map[d]) map[d] = 0;
            map[d]++;
        });
        return map;
    }
    const trfByDate = groupByDate(trf);
    const irfByDate = groupByDate(irf);
    const allDates = Array.from(new Set([...Object.keys(trfByDate), ...Object.keys(irfByDate)])).sort();
    const trfTotal = trf.length, irfTotal = irf.length;
    let html = `<table class="universal-table"><thead>
        <tr><th>Date</th><th>Outgoing train</th><th>Outgoing train %</th><th>IRF</th><th>IRF %</th></tr>
    </thead><tbody>`;
    allDates.forEach(date => {
        const t = trfByDate[date] || 0, i = irfByDate[date] || 0;
        html += `<tr>
            <td>${date}</td>
            <td>${t}</td>
            <td>${formatPercent(t, trfTotal)}</td>
            <td>${i}</td>
            <td>${formatPercent(i, irfTotal)}</td>
        </tr>`;
    });
    if (!allDates.length) html += `<tr><td colspan="5">No data</td></tr>`;
    html += `</tbody></table>`;
    return html;
}

// Draw chart for popup
let misLinkChartInstance = null, misHOGChartInstance = null;
function drawMisPopupChart(type, division) {
    const { trf, irf } = getMisPopupRows(type, division);
    // Group by date (last 15 days)
    function getLastNDates(n) {
        const arr = [];
        const today = new Date();
        today.setDate(today.getDate() - 1);
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            arr.push(formatDate(d));
        }
        return arr;
    }
    const last15 = getLastNDates(15);
    function countByDate(rows) {
        const map = {};
        rows.forEach(row => {
            const d = row[33] ? formatDate(new Date(row[33])) : '';
            if (!d) return;
            map[d] = (map[d] || 0) + 1;
        });
        return map;
    }
    const trfByDate = countByDate(trf);
    const irfByDate = countByDate(irf);
    const trfCounts = last15.map(date => trfByDate[date] || 0);
    const irfCounts = last15.map(date => irfByDate[date] || 0);
    const chartData = {
        labels: last15,
        datasets: [
            { label: 'Outgoing train', data: trfCounts, backgroundColor: '#00b4d8' },
            { label: 'IRF', data: irfCounts, backgroundColor: '#ff595e' }
        ]
    };
    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' },
            tooltip: { enabled: true },
            title: { display: false }
        },
        hover: { mode: 'nearest', intersect: true },
        scales: {
            x: { title: { display: true, text: 'Date' } },
            y: { title: { display: true, text: 'Count' }, beginAtZero: true }
        }
    };
    const canvasId = type === 'mis_link' ? 'misLinkChartCombined' : 'misHOGChartCombined';
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (type === 'mis_link' && misLinkChartInstance) misLinkChartInstance.destroy();
    if (type === 'mis_hog' && misHOGChartInstance) misHOGChartInstance.destroy();
    const chart = new Chart(ctx, { type: 'bar', data: chartData, options: chartOptions });
    if (type === 'mis_link') misLinkChartInstance = chart;
    else misHOGChartInstance = chart;
}

// Update popup UI (summary, chart, table, note)
function updateMisPopup(type) {
    const division = document.getElementById(type === 'mis_link' ? 'misLinkDivisionFilter' : 'misHOGDivisionFilter').value;
    // Summary
    document.getElementById(type === 'mis_link' ? 'misLinkChartSummary' : 'misHOGChartSummary').innerHTML =
        renderMisPopupSummary(type, division);
    // Chart
    drawMisPopupChart(type, division);
    // Note
    const noteDiv = document.createElement('div');
    noteDiv.style = "font-size:0.97em;color:#888;margin-bottom:4px;";
    noteDiv.textContent = "Tip: Hover or tap on chart bars/points to see details.";
    const chartDiv = document.getElementById(type === 'mis_link' ? 'misLinkChartCombined' : 'misHOGChartCombined').parentNode;
    if (chartDiv.nextSibling && chartDiv.nextSibling.className === 'mis-popup-note') {
        chartDiv.nextSibling.remove();
    }
    noteDiv.className = 'mis-popup-note';
    chartDiv.parentNode.insertBefore(noteDiv, chartDiv.nextSibling);
    // Table
    document.getElementById(type === 'mis_link' ? 'misLinkChartTable' : 'misHOGChartTable').innerHTML =
        renderMisPopupDateTable(type, division);
}

// Event listeners for division filter in popups
['misLinkDivisionFilter', 'misHOGDivisionFilter'].forEach(id => {
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === id) {
            updateMisPopup(id === 'misLinkDivisionFilter' ? 'mis_link' : 'mis_hog');
        }
    });
});

// Call this after data is loaded
function setupMisPopupsAfterData() {
    populatePopupDivisionFilters();
    updateMisPopup('mis_link');
    updateMisPopup('mis_hog');
}

// Call setupMisPopupsAfterData() after trfData/irfData are loaded in fetchData
const origFetchData = fetchData;
fetchData = async function() {
    await origFetchData.apply(this, arguments);
    setupMisPopupsAfterData();
};

// Initial setup on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    populatePopupDivisionFilters();
    updateMisPopup('mis_link');
    updateMisPopup('mis_hog');
    setDefaultDates();
});