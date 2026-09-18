/**
 * nano-ipam Frontend Application Logic
 */

// State Management
const state = {
  subnets: [],
  currentSubnet: null,
  stats: {},
  theme: localStorage.getItem('theme') || 'dark',
};

// DOM Elements
const elements = {
  themeToggle: document.getElementById('theme-toggle'),
  globalSearch: document.getElementById('global-search'),
  searchDropdown: document.getElementById('search-dropdown'),
  btnOpenCreateSubnet: document.getElementById('btn-open-create-subnet'),
  btnEmptyCreateSubnet: document.getElementById('btn-empty-create-subnet'),
  btnExportData: document.getElementById('btn-export-data'),

  // Views
  viewSubnets: document.getElementById('view-subnets'),
  viewSubnetDetail: document.getElementById('view-subnet-detail'),
  subnetsGrid: document.getElementById('subnets-grid'),
  subnetsEmpty: document.getElementById('subnets-empty'),
  subnetCountBadge: document.getElementById('subnet-count-badge'),
  subnetFilterInput: document.getElementById('subnet-filter-input'),

  // Stats
  statSubnets: document.getElementById('stat-subnets'),
  statAllocated: document.getElementById('stat-allocated'),
  statReserved: document.getElementById('stat-reserved'),
  statAvailable: document.getElementById('stat-available'),
  statUtilization: document.getElementById('stat-utilization'),
  statUtilizationBar: document.getElementById('stat-utilization-bar'),

  // Detail View Elements
  btnBackToSubnets: document.getElementById('btn-back-to-subnets'),
  detailSubnetName: document.getElementById('detail-subnet-name'),
  detailSubnetCidr: document.getElementById('detail-subnet-cidr'),
  detailSubnetVlan: document.getElementById('detail-subnet-vlan'),
  detailSubnetSite: document.getElementById('detail-subnet-site'),
  detailGateway: document.getElementById('detail-gateway'),
  detailRange: document.getElementById('detail-range'),
  detailNetmask: document.getElementById('detail-netmask'),
  detailBroadcast: document.getElementById('detail-broadcast'),
  detailDns: document.getElementById('detail-dns'),
  detailUtilizationText: document.getElementById('detail-utilization-text'),
  btnQuickAllocate: document.getElementById('btn-quick-allocate'),
  quickNextIp: document.getElementById('quick-next-ip'),
  btnManualAllocate: document.getElementById('btn-manual-allocate'),
  btnEditCurrentSubnet: document.getElementById('btn-edit-current-subnet'),
  btnDeleteCurrentSubnet: document.getElementById('btn-delete-current-subnet'),
  allocationsTbody: document.getElementById('allocations-tbody'),
  allocationCountBadge: document.getElementById('allocation-count-badge'),
  allocationStatusFilter: document.getElementById('allocation-status-filter'),
  allocationFilterInput: document.getElementById('allocation-filter-input'),

  // Subnet Modal
  modalSubnet: document.getElementById('modal-subnet'),
  modalSubnetTitle: document.getElementById('modal-subnet-title'),
  formSubnet: document.getElementById('form-subnet'),
  subnetId: document.getElementById('subnet-id'),
  subnetName: document.getElementById('subnet-name'),
  subnetVlan: document.getElementById('subnet-vlan'),
  subnetCidr: document.getElementById('subnet-cidr'),
  cidrPreview: document.getElementById('cidr-preview'),
  cidrError: document.getElementById('cidr-error'),
  subnetGateway: document.getElementById('subnet-gateway'),
  subnetDns: document.getElementById('subnet-dns'),
  subnetSite: document.getElementById('subnet-site'),
  subnetDesc: document.getElementById('subnet-desc'),
  subnetAutoGateway: document.getElementById('subnet-auto-gateway'),
  autoGatewayGroup: document.getElementById('auto-gateway-group'),
  btnCloseSubnetModal: document.getElementById('btn-close-subnet-modal'),
  btnCancelSubnet: document.getElementById('btn-cancel-subnet'),

  // Allocation Modal
  modalAllocation: document.getElementById('modal-allocation'),
  modalAllocationTitle: document.getElementById('modal-allocation-title'),
  formAllocation: document.getElementById('form-allocation'),
  allocationId: document.getElementById('allocation-id'),
  allocationSubnetId: document.getElementById('allocation-subnet-id'),
  allocationIp: document.getElementById('allocation-ip'),
  btnAutofillNextIp: document.getElementById('btn-autofill-next-ip'),
  allocationStatus: document.getElementById('allocation-status'),
  allocationHostname: document.getElementById('allocation-hostname'),
  allocationType: document.getElementById('allocation-type'),
  allocationMac: document.getElementById('allocation-mac'),
  allocationOwner: document.getElementById('allocation-owner'),
  allocationDesc: document.getElementById('allocation-desc'),
  allocationError: document.getElementById('allocation-error'),
  btnCloseAllocationModal: document.getElementById('btn-close-allocation-modal'),
  btnCancelAllocation: document.getElementById('btn-cancel-allocation'),

  btnOpenSweep: document.getElementById('btn-open-sweep'),
  btnImportData: document.getElementById('btn-import-data'),
  modalImport: document.getElementById('modal-import'),
  formImport: document.getElementById('form-import'),
  btnCloseImportModal: document.getElementById('btn-close-import-modal'),
  btnCancelImport: document.getElementById('btn-cancel-import'),
  tabBtnJson: document.getElementById('tab-btn-json'),
  tabBtnCsv: document.getElementById('tab-btn-csv'),
  tabContentJson: document.getElementById('tab-content-json'),
  tabContentCsv: document.getElementById('tab-content-csv'),
  importJsonFile: document.getElementById('import-json-file'),
  importJsonText: document.getElementById('import-json-text'),
  importJsonMode: document.getElementById('import-json-mode'),
  importCsvFile: document.getElementById('import-csv-file'),
  importCsvSubnet: document.getElementById('import-csv-subnet'),
  importCsvText: document.getElementById('import-csv-text'),
  importResult: document.getElementById('import-result'),
  btnSubmitImport: document.getElementById('btn-submit-import'),

  modalSweep: document.getElementById('modal-sweep'),
  modalSweepTitle: document.getElementById('modal-sweep-title'),
  sweepTargetBadge: document.getElementById('sweep-target-badge'),
  btnCloseSweepModal: document.getElementById('btn-close-sweep-modal'),
  btnCloseSweepDone: document.getElementById('btn-close-sweep-done'),
  sweepMode: document.getElementById('sweep-mode'),
  sweepConcurrency: document.getElementById('sweep-concurrency'),
  btnStartSweep: document.getElementById('btn-start-sweep'),
  sweepLoading: document.getElementById('sweep-loading'),
  sweepStatusDesc: document.getElementById('sweep-status-desc'),
  sweepSummary: document.getElementById('sweep-summary'),
  sweepStatScanned: document.getElementById('sweep-stat-scanned'),
  sweepStatAlive: document.getElementById('sweep-stat-alive'),
  sweepStatUnallocated: document.getElementById('sweep-stat-unallocated'),
  sweepUnallocatedSection: document.getElementById('sweep-unallocated-section'),
  unallocatedCountBadge: document.getElementById('unallocated-count-badge'),
  sweepUnallocatedTbody: document.getElementById('sweep-unallocated-tbody'),

  toastContainer: document.getElementById('toast-container'),
};

// ==========================================================================
// Initialization & Theming
// ==========================================================================

function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  elements.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('theme', state.theme);
  });
}

// ==========================================================================
// API Calls & Data Fetching
// ==========================================================================

async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('Failed to load stats');
    state.stats = await res.json();
    renderStats();
  } catch (err) {
    console.error('Stats error:', err);
  }
}

async function fetchSubnets() {
  try {
    const res = await fetch('/api/subnets');
    if (!res.ok) throw new Error('Failed to load subnets');
    state.subnets = await res.json();
    renderSubnets();
  } catch (err) {
    showToast(`Error fetching subnets: ${err.message}`, 'error');
  }
}

async function loadSubnetDetail(id) {
  try {
    const res = await fetch(`/api/subnets/${id}`);
    if (!res.ok) throw new Error('Failed to load subnet details');
    state.currentSubnet = await res.json();
    renderSubnetDetail();
    showView('detail');
  } catch (err) {
    showToast(`Error loading subnet: ${err.message}`, 'error');
  }
}

// ==========================================================================
// Render Functions
// ==========================================================================

function renderStats() {
  const s = state.stats;
  elements.statSubnets.textContent = s.totalSubnets ?? 0;
  elements.statAllocated.textContent = s.totalAllocated ?? 0;
  elements.statReserved.textContent = s.totalReserved ?? 0;
  elements.statAvailable.textContent = s.availableIps ?? 0;
  
  const util = s.overallUtilization ?? 0;
  elements.statUtilization.textContent = `${util}%`;
  elements.statUtilizationBar.style.width = `${util}%`;

  if (util > 90) {
    elements.statUtilizationBar.style.backgroundColor = 'var(--color-danger)';
  } else if (util > 70) {
    elements.statUtilizationBar.style.backgroundColor = 'var(--color-warning)';
  } else {
    elements.statUtilizationBar.style.backgroundColor = 'var(--accent-primary)';
  }
}

function renderSubnets() {
  const query = elements.subnetFilterInput.value.toLowerCase().trim();
  const filtered = state.subnets.filter(s => {
    return s.name.toLowerCase().includes(query) ||
           s.cidr.toLowerCase().includes(query) ||
           (s.site && s.site.toLowerCase().includes(query)) ||
           (s.vlan && String(s.vlan).includes(query));
  });

  elements.subnetCountBadge.textContent = `${filtered.length} Subnet${filtered.length === 1 ? '' : 's'}`;

  if (state.subnets.length === 0) {
    elements.subnetsGrid.innerHTML = '';
    elements.subnetsEmpty.classList.remove('hidden');
    return;
  }

  elements.subnetsEmpty.classList.add('hidden');
  elements.subnetsGrid.innerHTML = filtered.map(sub => {
    const stats = sub.stats || { allocatedCount: 0, usableHosts: 0, percentUsed: 0, availableCount: 0 };
    const util = stats.percentUsed;
    let utilColor = 'var(--color-success)';
    if (util > 90) utilColor = 'var(--color-danger)';
    else if (util > 70) utilColor = 'var(--color-warning)';

    return `
      <div class="subnet-card" onclick="loadSubnetDetail(${sub.id})">
        <div>
          <div class="subnet-card-header">
            <div class="subnet-card-title">${escapeHtml(sub.name)}</div>
          </div>
          <div class="subnet-card-cidr">${escapeHtml(sub.cidr)}</div>
          <div class="subnet-badges">
            ${sub.vlan ? `<span class="badge badge-vlan">VLAN ${sub.vlan}</span>` : ''}
            ${sub.site ? `<span class="badge badge-site">${escapeHtml(sub.site)}</span>` : ''}
            ${sub.gateway ? `<span class="badge badge-neutral">GW: ${escapeHtml(sub.gateway)}</span>` : ''}
          </div>
        </div>

        <div class="subnet-util-section">
          <div class="subnet-util-meta">
            <span>${stats.allocatedCount} / ${stats.usableHosts} IPs (${stats.availableCount} free)</span>
            <span style="color: ${utilColor}; font-weight: 600;">${util}%</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${util}%; background-color: ${utilColor};"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderSubnetDetail() {
  const s = state.currentSubnet;
  if (!s) return;

  elements.detailSubnetName.textContent = s.name;
  elements.detailSubnetCidr.textContent = s.cidr;

  if (s.vlan) {
    elements.detailSubnetVlan.textContent = `VLAN ${s.vlan}`;
    elements.detailSubnetVlan.classList.remove('hidden');
  } else {
    elements.detailSubnetVlan.classList.add('hidden');
  }

  if (s.site) {
    elements.detailSubnetSite.textContent = s.site;
    elements.detailSubnetSite.classList.remove('hidden');
  } else {
    elements.detailSubnetSite.classList.add('hidden');
  }

  elements.detailGateway.textContent = s.gateway || 'None';
  elements.detailRange.textContent = s.cidrInfo ? `${s.cidrInfo.firstUsableIp} - ${s.cidrInfo.lastUsableIp}` : '-';
  elements.detailNetmask.textContent = s.cidrInfo ? s.cidrInfo.netmask : '-';
  elements.detailBroadcast.textContent = s.cidrInfo ? s.cidrInfo.broadcastAddress : '-';
  elements.detailDns.textContent = s.dns || 'None';

  const stats = s.stats || { allocatedCount: 0, usableHosts: 0, percentUsed: 0 };
  elements.detailUtilizationText.textContent = `${stats.percentUsed}% (${stats.allocatedCount}/${stats.usableHosts})`;

  if (s.nextAvailableIp) {
    elements.quickNextIp.textContent = s.nextAvailableIp;
    elements.btnQuickAllocate.disabled = false;
  } else {
    elements.quickNextIp.textContent = 'Full';
    elements.btnQuickAllocate.disabled = true;
  }

  renderAllocationsTable();
}

function renderAllocationsTable() {
  const s = state.currentSubnet;
  if (!s) return;

  const statusFilter = elements.allocationStatusFilter.value;
  const searchFilter = elements.allocationFilterInput.value.toLowerCase().trim();

  const filtered = (s.allocations || []).filter(a => {
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchesSearch = !searchFilter || 
      a.ip.toLowerCase().includes(searchFilter) ||
      (a.hostname && a.hostname.toLowerCase().includes(searchFilter)) ||
      (a.mac && a.mac.toLowerCase().includes(searchFilter)) ||
      (a.owner && a.owner.toLowerCase().includes(searchFilter)) ||
      (a.description && a.description.toLowerCase().includes(searchFilter));
    return matchesStatus && matchesSearch;
  });

  elements.allocationCountBadge.textContent = `${filtered.length} IP${filtered.length === 1 ? '' : 's'}`;

  if (filtered.length === 0) {
    elements.allocationsTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
          No allocated IPs found in this view.
        </td>
      </tr>
    `;
    return;
  }

  elements.allocationsTbody.innerHTML = filtered.map(a => {
    return `
      <tr>
        <td>
          <div class="ip-cell">
            <span class="ping-status-dot" id="ping-dot-${a.ip.replace(/\./g, '-')}" title="Click to test ping" onclick="pingSingleIp('${escapeHtml(a.ip)}')">⚪</span>
            <span>${escapeHtml(a.ip)}</span>
            <span class="copy-btn" onclick="copyToClipboard('${escapeHtml(a.ip)}')" title="Copy IP">📋</span>
          </div>
        </td>
        <td>
          <span class="badge badge-${a.status}">${escapeHtml(a.status)}</span>
        </td>
        <td>
          <span style="text-transform: capitalize;">${escapeHtml(a.device_type || 'other')}</span>
        </td>
        <td>
          <strong>${escapeHtml(a.hostname || '-')}</strong>
        </td>
        <td>
          <span class="mac-cell">${escapeHtml(a.mac || '-')}</span>
        </td>
        <td>
          <div>${escapeHtml(a.description || '-')}</div>
          ${a.owner ? `<div style="font-size: 0.75rem; color: var(--text-muted);">Owner: ${escapeHtml(a.owner)}</div>` : ''}
        </td>
        <td class="text-right">
          <button class="btn btn-ghost btn-sm" onclick="pingSingleIp('${escapeHtml(a.ip)}')" title="Ping Host">
            📡
          </button>
          <button class="btn btn-ghost btn-sm" onclick="openEditAllocationModal(${a.id})" title="Edit">
            ✏️
          </button>
          <button class="btn btn-ghost btn-sm text-danger" onclick="releaseAllocation(${a.id}, '${escapeHtml(a.ip)}')" title="Release IP">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================================================
// Modal & Action Handlers
// ==========================================================================

function showView(view) {
  if (view === 'detail') {
    elements.viewSubnets.classList.add('hidden');
    elements.viewSubnetDetail.classList.remove('hidden');
  } else {
    elements.viewSubnetDetail.classList.add('hidden');
    elements.viewSubnets.classList.remove('hidden');
    state.currentSubnet = null;
    fetchSubnets();
    fetchStats();
  }
}

function openCreateSubnetModal() {
  elements.modalSubnetTitle.textContent = 'Create New Subnet';
  elements.formSubnet.reset();
  elements.subnetId.value = '';
  elements.cidrPreview.classList.add('hidden');
  elements.cidrError.classList.add('hidden');
  elements.autoGatewayGroup.classList.remove('hidden');
  elements.modalSubnet.classList.remove('hidden');
  elements.subnetName.focus();
}

function openEditSubnetModal(subnet) {
  elements.modalSubnetTitle.textContent = 'Edit Subnet';
  elements.formSubnet.reset();
  elements.subnetId.value = subnet.id;
  elements.subnetName.value = subnet.name;
  elements.subnetVlan.value = subnet.vlan || '';
  elements.subnetCidr.value = subnet.cidr;
  elements.subnetCidr.disabled = true; // CIDR cannot be mutated on edit to prevent orphaned allocations
  elements.subnetGateway.value = subnet.gateway || '';
  elements.subnetDns.value = subnet.dns || '';
  elements.subnetSite.value = subnet.site || '';
  elements.subnetDesc.value = subnet.description || '';
  elements.autoGatewayGroup.classList.add('hidden');
  elements.cidrPreview.classList.add('hidden');
  elements.cidrError.classList.add('hidden');
  elements.modalSubnet.classList.remove('hidden');
}

function openAllocateModal(ipPrefill = '', isEdit = false, allocationData = null) {
  elements.formAllocation.reset();
  elements.allocationError.classList.add('hidden');
  elements.allocationSubnetId.value = state.currentSubnet.id;

  if (isEdit && allocationData) {
    elements.modalAllocationTitle.textContent = `Edit IP Allocation (${allocationData.ip})`;
    elements.allocationId.value = allocationData.id;
    elements.allocationIp.value = allocationData.ip;
    elements.allocationIp.disabled = true;
    elements.btnAutofillNextIp.classList.add('hidden');
    elements.allocationStatus.value = allocationData.status;
    elements.allocationHostname.value = allocationData.hostname || '';
    elements.allocationType.value = allocationData.device_type || 'other';
    elements.allocationMac.value = allocationData.mac || '';
    elements.allocationOwner.value = allocationData.owner || '';
    elements.allocationDesc.value = allocationData.description || '';
  } else {
    elements.modalAllocationTitle.textContent = `Allocate IP in ${state.currentSubnet.cidr}`;
    elements.allocationId.value = '';
    elements.allocationIp.value = ipPrefill || state.currentSubnet.nextAvailableIp || '';
    elements.allocationIp.disabled = false;
    elements.btnAutofillNextIp.classList.remove('hidden');
    elements.allocationStatus.value = 'active';
    elements.allocationType.value = (allocationData && allocationData.device_type) ? allocationData.device_type : 'lxc';
    if (allocationData && allocationData.mac) {
      elements.allocationMac.value = allocationData.mac;
    }
  }

  elements.modalAllocation.classList.remove('hidden');
  if (!elements.allocationIp.value) {
    elements.allocationIp.focus();
  } else {
    elements.allocationHostname.focus();
  }
}

window.openEditAllocationModal = function(allocationId) {
  const alloc = state.currentSubnet.allocations.find(a => a.id === allocationId);
  if (alloc) {
    openAllocateModal(alloc.ip, true, alloc);
  }
};

window.releaseAllocation = async function(allocationId, ip) {
  if (!confirm(`Are you sure you want to release IP address ${ip}?`)) return;

  try {
    const res = await fetch(`/api/allocations/${allocationId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to release IP');
    }
    showToast(`Released IP ${ip}`, 'success');
    await loadSubnetDetail(state.currentSubnet.id);
    fetchStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ==========================================================================
// Form Submissions
// ==========================================================================

elements.formSubnet.addEventListener('submit', async (e) => {
  e.preventDefault();
  elements.cidrError.classList.add('hidden');

  const id = elements.subnetId.value;
  const isUpdate = Boolean(id);

  const payload = {
    name: elements.subnetName.value.trim(),
    cidr: elements.subnetCidr.value.trim(),
    vlan: elements.subnetVlan.value ? Number(elements.subnetVlan.value) : null,
    gateway: elements.subnetGateway.value.trim() || null,
    dns: elements.subnetDns.value.trim() || null,
    site: elements.subnetSite.value.trim() || null,
    description: elements.subnetDesc.value.trim() || null,
    autoReserveGateway: elements.subnetAutoGateway.checked,
  };

  try {
    const url = isUpdate ? `/api/subnets/${id}` : '/api/subnets';
    const method = isUpdate ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409 && data.canOverride) {
        if (confirm(`${data.error}\n\nDo you want to create this overlapping subnet anyway?`)) {
          payload.allowOverlap = true;
          const retryRes = await fetch('/api/subnets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!retryRes.ok) {
            const retryData = await retryRes.json();
            throw new Error(retryData.error || 'Failed to create subnet');
          }
          elements.modalSubnet.classList.add('hidden');
          showToast('Subnet created successfully', 'success');
          fetchSubnets();
          fetchStats();
          return;
        }
      }
      throw new Error(data.error || 'Failed to save subnet');
    }

    elements.modalSubnet.classList.add('hidden');
    elements.subnetCidr.disabled = false;
    showToast(isUpdate ? 'Subnet updated' : 'Subnet created', 'success');

    if (isUpdate && state.currentSubnet && state.currentSubnet.id === Number(id)) {
      loadSubnetDetail(id);
    } else {
      fetchSubnets();
    }
    fetchStats();
  } catch (err) {
    elements.cidrError.textContent = err.message;
    elements.cidrError.classList.remove('hidden');
  }
});

elements.formAllocation.addEventListener('submit', async (e) => {
  e.preventDefault();
  elements.allocationError.classList.add('hidden');

  const id = elements.allocationId.value;
  const isUpdate = Boolean(id);

  const payload = {
    subnet_id: Number(elements.allocationSubnetId.value),
    ip: elements.allocationIp.value.trim(),
    hostname: elements.allocationHostname.value.trim() || null,
    device_type: elements.allocationType.value,
    status: elements.allocationStatus.value,
    mac: elements.allocationMac.value.trim() || null,
    owner: elements.allocationOwner.value.trim() || null,
    description: elements.allocationDesc.value.trim() || null,
  };

  try {
    const url = isUpdate ? `/api/allocations/${id}` : '/api/allocations';
    const method = isUpdate ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save allocation');
    }

    elements.modalAllocation.classList.add('hidden');
    elements.allocationIp.disabled = false;
    showToast(isUpdate ? 'Allocation updated' : `Allocated ${payload.ip}`, 'success');

    await loadSubnetDetail(state.currentSubnet.id);
    fetchStats();
  } catch (err) {
    elements.allocationError.textContent = err.message;
    elements.allocationError.classList.remove('hidden');
  }
});

// ==========================================================================
// Event Listeners
// ==========================================================================

elements.btnOpenCreateSubnet.addEventListener('click', openCreateSubnetModal);
elements.btnEmptyCreateSubnet.addEventListener('click', openCreateSubnetModal);
elements.btnCloseSubnetModal.addEventListener('click', () => {
  elements.modalSubnet.classList.add('hidden');
  elements.subnetCidr.disabled = false;
});
elements.btnCancelSubnet.addEventListener('click', () => {
  elements.modalSubnet.classList.add('hidden');
  elements.subnetCidr.disabled = false;
});

elements.btnBackToSubnets.addEventListener('click', () => showView('subnets'));

elements.btnQuickAllocate.addEventListener('click', () => {
  if (state.currentSubnet && state.currentSubnet.nextAvailableIp) {
    openAllocateModal(state.currentSubnet.nextAvailableIp);
  }
});

elements.btnManualAllocate.addEventListener('click', () => {
  openAllocateModal();
});

elements.btnAutofillNextIp.addEventListener('click', () => {
  if (state.currentSubnet && state.currentSubnet.nextAvailableIp) {
    elements.allocationIp.value = state.currentSubnet.nextAvailableIp;
  }
});

elements.btnCloseAllocationModal.addEventListener('click', () => {
  elements.modalAllocation.classList.add('hidden');
  elements.allocationIp.disabled = false;
});
elements.btnCancelAllocation.addEventListener('click', () => {
  elements.modalAllocation.classList.add('hidden');
  elements.allocationIp.disabled = false;
});

elements.btnEditCurrentSubnet.addEventListener('click', () => {
  if (state.currentSubnet) {
    openEditSubnetModal(state.currentSubnet);
  }
});

elements.btnDeleteCurrentSubnet.addEventListener('click', async () => {
  if (!state.currentSubnet) return;
  const s = state.currentSubnet;
  if (!confirm(`Are you sure you want to delete subnet "${s.name}" (${s.cidr}) and ALL its IP allocations? This cannot be undone.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/subnets/${s.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete subnet');
    showToast(`Subnet ${s.cidr} deleted`, 'success');
    showView('subnets');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

elements.btnExportData.addEventListener('click', () => {
  window.location.href = '/api/export';
});

// Filters
elements.subnetFilterInput.addEventListener('input', renderSubnets);
elements.allocationFilterInput.addEventListener('input', renderAllocationsTable);
elements.allocationStatusFilter.addEventListener('change', renderAllocationsTable);

// Global Search
let searchDebounce = null;
elements.globalSearch.addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  const q = e.target.value.trim();
  if (!q) {
    elements.searchDropdown.classList.add('hidden');
    elements.searchDropdown.innerHTML = '';
    return;
  }

  searchDebounce = setTimeout(async () => {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const results = await res.json();
      renderSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    }
  }, 200);
});

function renderSearchResults(results) {
  const { subnets, allocations } = results;
  if (subnets.length === 0 && allocations.length === 0) {
    elements.searchDropdown.innerHTML = `
      <div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        No matching subnets or IP records found
      </div>
    `;
    elements.searchDropdown.classList.remove('hidden');
    return;
  }

  let html = '';
  if (subnets.length > 0) {
    html += `<div style="padding: 6px 12px; font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted); background: var(--bg-surface-elevated);">Subnets</div>`;
    html += subnets.map(s => `
      <div class="search-result-item" onclick="selectSearchResult('subnet', ${s.id})">
        <div>
          <strong>${escapeHtml(s.name)}</strong>
          <span style="font-family: var(--font-mono); color: var(--accent-primary); margin-left: 8px;">${escapeHtml(s.cidr)}</span>
        </div>
        ${s.site ? `<span class="badge badge-site">${escapeHtml(s.site)}</span>` : ''}
      </div>
    `).join('');
  }

  if (allocations.length > 0) {
    html += `<div style="padding: 6px 12px; font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted); background: var(--bg-surface-elevated);">IP Allocations</div>`;
    html += allocations.map(a => `
      <div class="search-result-item" onclick="selectSearchResult('allocation', ${a.subnet_id})">
        <div>
          <strong style="font-family: var(--font-mono);">${escapeHtml(a.ip)}</strong>
          ${a.hostname ? `<span style="margin-left: 8px; color: var(--text-secondary);">${escapeHtml(a.hostname)}</span>` : ''}
        </div>
        <span class="badge badge-${a.status}">${escapeHtml(a.status)}</span>
      </div>
    `).join('');
  }

  elements.searchDropdown.innerHTML = html;
  elements.searchDropdown.classList.remove('hidden');
}

window.selectSearchResult = function(type, subnetId) {
  elements.searchDropdown.classList.add('hidden');
  elements.globalSearch.value = '';
  loadSubnetDetail(subnetId);
};

// Close search dropdown on click outside
document.addEventListener('click', (e) => {
  if (!elements.searchContainer?.contains(e.target) && !elements.searchDropdown.contains(e.target)) {
    elements.searchDropdown.classList.add('hidden');
  }
});

// Keyboard shortcut '/' to search
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== elements.globalSearch && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    elements.globalSearch.focus();
  }
});

// Helper utilities
window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied ${text} to clipboard`, 'info');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
};

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// ==========================================================================
// Ping & ARP Actions
// ==========================================================================

window.pingSingleIp = async function(ip) {
  const ipSafe = ip.replace(/\./g, '-');
  const dot = document.getElementById(`ping-dot-${ipSafe}`);
  if (dot) {
    dot.textContent = '🟡';
    dot.classList.add('pulse');
    dot.title = `Pinging ${ip}...`;
  }

  try {
    const res = await fetch(`/api/network/ping/${encodeURIComponent(ip)}`);
    const data = await res.json();
    if (dot) {
      dot.classList.remove('pulse');
      if (data.alive) {
        dot.textContent = '🟢';
        dot.title = `Online (${data.roundTripMs}ms)${data.mac ? ' [MAC: ' + data.mac + ']' : ''}`;
        showToast(`Host ${ip} is ONLINE (${data.roundTripMs}ms)`, 'success');
      } else {
        dot.textContent = '🔴';
        dot.title = 'Offline / No response';
        showToast(`Host ${ip} did not respond to ping`, 'error');
      }
    }
  } catch (err) {
    if (dot) {
      dot.classList.remove('pulse');
      dot.textContent = '⚪';
    }
    showToast(`Failed to ping ${ip}: ${err.message}`, 'error');
  }
};

window.adoptHost = function(ip, mac) {
  elements.modalSweep.classList.add('hidden');
  openAllocateModal(ip, false, { ip, mac: mac || '' });
  elements.allocationHostname.focus();
};

// ==========================================================================
// Import Modal Handling
// ==========================================================================

let activeImportTab = 'json';

elements.btnImportData.addEventListener('click', () => {
  elements.importCsvSubnet.innerHTML = '<option value="">Auto-match by IP / CIDR column</option>' +
    state.subnets.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${s.cidr})</option>`).join('');
  
  elements.formImport.reset();
  elements.importResult.classList.add('hidden');
  elements.modalImport.classList.remove('hidden');
});

elements.btnCloseImportModal.addEventListener('click', () => elements.modalImport.classList.add('hidden'));
elements.btnCancelImport.addEventListener('click', () => elements.modalImport.classList.add('hidden'));

elements.tabBtnJson.addEventListener('click', () => {
  activeImportTab = 'json';
  elements.tabBtnJson.classList.add('active');
  elements.tabBtnCsv.classList.remove('active');
  elements.tabContentJson.classList.remove('hidden');
  elements.tabContentCsv.classList.add('hidden');
});

elements.tabBtnCsv.addEventListener('click', () => {
  activeImportTab = 'csv';
  elements.tabBtnCsv.classList.add('active');
  elements.tabBtnJson.classList.remove('active');
  elements.tabContentCsv.classList.remove('hidden');
  elements.tabContentJson.classList.add('hidden');
});

elements.importJsonFile.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      elements.importJsonText.value = evt.target.result;
    };
    reader.readAsText(file);
  }
});

elements.importCsvFile.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      elements.importCsvText.value = evt.target.result;
    };
    reader.readAsText(file);
  }
});

elements.formImport.addEventListener('submit', async (e) => {
  e.preventDefault();
  elements.importResult.classList.add('hidden');
  elements.btnSubmitImport.disabled = true;
  elements.btnSubmitImport.textContent = 'Importing...';

  try {
    let payload;
    if (activeImportTab === 'json') {
      const text = elements.importJsonText.value.trim();
      if (!text) throw new Error('Please upload or paste JSON data');
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON format');
      }
      payload = {
        format: 'json',
        data: parsed,
        mode: elements.importJsonMode.value,
      };
    } else {
      const csv = elements.importCsvText.value.trim();
      if (!csv) throw new Error('Please upload or paste CSV data');
      payload = {
        format: 'csv',
        csv,
        subnet_id: elements.importCsvSubnet.value || null,
      };
    }

    const res = await fetch('/api/network/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Import failed');
    }

    const s = result.summary;
    const msg = `Import complete: ${s.subnetsCreated} subnets created, ${s.subnetsUpdated} updated. ${s.allocationsCreated} allocations created, ${s.allocationsUpdated} updated.${s.errors.length > 0 ? ` (${s.errors.length} warnings)` : ''}`;
    
    elements.importResult.textContent = msg;
    elements.importResult.classList.remove('hidden');
    showToast(msg, s.errors.length > 0 ? 'warning' : 'success');

    await fetchSubnets();
    await fetchStats();
    if (state.currentSubnet) {
      await loadSubnetDetail(state.currentSubnet.id);
    }
  } catch (err) {
    elements.importResult.textContent = err.message;
    elements.importResult.classList.remove('hidden');
  } finally {
    elements.btnSubmitImport.disabled = false;
    elements.btnSubmitImport.textContent = 'Start Import';
  }
});

// ==========================================================================
// Ping Sweep Modal Handling
// ==========================================================================

elements.btnOpenSweep.addEventListener('click', () => {
  if (!state.currentSubnet) return;
  elements.sweepTargetBadge.textContent = state.currentSubnet.cidr;
  elements.sweepSummary.classList.add('hidden');
  elements.sweepLoading.classList.add('hidden');
  elements.sweepUnallocatedSection.classList.add('hidden');
  elements.btnStartSweep.disabled = false;
  elements.modalSweep.classList.remove('hidden');
});

elements.btnCloseSweepModal.addEventListener('click', () => elements.modalSweep.classList.add('hidden'));
elements.btnCloseSweepDone.addEventListener('click', () => elements.modalSweep.classList.add('hidden'));

elements.btnStartSweep.addEventListener('click', async () => {
  if (!state.currentSubnet) return;
  const subnetId = state.currentSubnet.id;
  const mode = elements.sweepMode.value;
  const concurrency = Number(elements.sweepConcurrency.value) || 25;

  elements.btnStartSweep.disabled = true;
  elements.sweepLoading.classList.remove('hidden');
  elements.sweepSummary.classList.add('hidden');
  elements.sweepUnallocatedSection.classList.add('hidden');
  elements.sweepStatusDesc.textContent = `Pinging hosts in ${state.currentSubnet.cidr} with ${concurrency} parallel workers...`;

  try {
    const res = await fetch(`/api/network/sweep/${subnetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, concurrency }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ping sweep failed');

    elements.sweepStatScanned.textContent = data.scannedCount;
    elements.sweepStatAlive.textContent = data.aliveCount;
    elements.sweepStatUnallocated.textContent = data.unallocatedAlive.length;
    elements.sweepSummary.classList.remove('hidden');

    if (Array.isArray(data.results)) {
      data.results.forEach(r => {
        const dot = document.getElementById(`ping-dot-${r.ip.replace(/\./g, '-')}`);
        if (dot) {
          if (r.alive) {
            dot.textContent = '🟢';
            dot.title = `Online (${r.roundTripMs}ms)${r.mac ? ' [MAC: ' + r.mac + ']' : ''}`;
          } else {
            dot.textContent = '🔴';
            dot.title = 'Offline';
          }
        }
      });
    }

    if (data.unallocatedAlive.length > 0) {
      elements.unallocatedCountBadge.textContent = `${data.unallocatedAlive.length} host${data.unallocatedAlive.length === 1 ? '' : 's'}`;
      elements.sweepUnallocatedTbody.innerHTML = data.unallocatedAlive.map(h => `
        <tr>
          <td><span style="font-family: var(--font-mono); font-weight:600;">${escapeHtml(h.ip)}</span></td>
          <td>${h.roundTripMs ? h.roundTripMs + 'ms' : '<1ms'}</td>
          <td><span class="mac-cell">${escapeHtml(h.mac || '-')}</span></td>
          <td class="text-right">
            <button class="btn btn-primary btn-sm" onclick="adoptHost('${escapeHtml(h.ip)}', '${escapeHtml(h.mac || '')}')">
              + Add to Subnet
            </button>
          </td>
        </tr>
      `).join('');
      elements.sweepUnallocatedSection.classList.remove('hidden');
    }

    showToast(`Sweep finished: ${data.aliveCount} online hosts detected`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    elements.sweepLoading.classList.add('hidden');
    elements.btnStartSweep.disabled = false;
  }
});

// Initial Boot
initTheme();
fetchStats();
fetchSubnets();
