document.addEventListener('DOMContentLoaded', () => {

    // ===== STATE =====
    let subjectId = 0;
    let subjects = [];
    let results = [];

    // ===== DOM REFS =====
    const $ = id => document.getElementById(id);
    const subjectChips = $('subject-chips');
    const inputHeader = $('input-header');
    const inputBody = $('input-body');
    const dashboard = $('dashboard');
    const resultsHeader = $('results-header');
    const resultsBody = $('results-body');
    const profileOverlay = $('profile-overlay');
    const profileDrawer = $('profile-drawer');
    let barChart = null, pieChart = null;

    // ===== THEME =====
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    $('theme-icon').textContent = theme === 'dark' ? '🌙' : '☀️';

    $('theme-toggle').addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        $('theme-icon').textContent = next === 'dark' ? '🌙' : '☀️';
    });

    // ===== SUBJECTS =====
    function addSubject(name) {
        subjectId++;
        const s = { id: subjectId, name: name || `Subject ${subjectId}` };
        subjects.push(s);
        renderSubjectChips();
        rebuildInputTable();
    }

    function removeSubject(id) {
        if (subjects.length <= 1) { alert('You need at least one subject.'); return; }
        subjects = subjects.filter(s => s.id !== id);
        renderSubjectChips();
        rebuildInputTable();
    }

    function renameSubject(id, newName) {
        const s = subjects.find(s => s.id === id);
        if (s) s.name = newName || s.name;
        rebuildInputTableHeaders();
        if (!dashboard.classList.contains('hidden')) rebuildResultsHeaders();
    }

    function renderSubjectChips() {
        subjectChips.innerHTML = '';
        subjects.forEach(s => {
            const chip = document.createElement('div');
            chip.className = 'subject-chip';
            chip.innerHTML = `<input type="text" value="${esc(s.name)}" data-sid="${s.id}">
                <button class="chip-remove" data-sid="${s.id}">✕</button>`;
            chip.querySelector('input').addEventListener('change', e => renameSubject(s.id, e.target.value.trim()));
            chip.querySelector('.chip-remove').addEventListener('click', () => removeSubject(s.id));
            subjectChips.appendChild(chip);
        });
    }

    $('add-subject-btn').addEventListener('click', () => addSubject(''));

    // Default subjects
    ['Mathematics', 'Science', 'English'].forEach(n => addSubject(n));

    // ===== INPUT TABLE =====
    function rebuildInputTableHeaders() {
        const nameThIndex = 2; // after # and Name
        // Remove old subject ths
        while (inputHeader.children.length > 3) inputHeader.removeChild(inputHeader.children[nameThIndex]);
        // Insert subject ths before action column
        const actionTh = inputHeader.lastElementChild;
        subjects.forEach(s => {
            const th = document.createElement('th');
            th.textContent = s.name;
            th.className = 'col-subj';
            inputHeader.insertBefore(th, actionTh);
        });
    }

    function rebuildInputTable() {
        rebuildInputTableHeaders();
        // Update existing rows to match subjects
        const rows = inputBody.querySelectorAll('tr');
        rows.forEach(tr => syncRowSubjects(tr));
        if (rows.length === 0) { addStudentRow(); addStudentRow(); addStudentRow(); }
    }

    function syncRowSubjects(tr) {
        // Keep first td (num) and second td (name), rebuild subject tds, keep last td (action)
        const numTd = tr.children[0];
        const nameTd = tr.children[1];
        const actionTd = tr.lastElementChild;
        // Collect existing marks by subject id
        const existing = {};
        tr.querySelectorAll('td[data-sid]').forEach(td => {
            existing[td.dataset.sid] = td.querySelector('input').value;
        });
        // Remove all middle tds
        while (tr.children.length > 3) tr.removeChild(tr.children[2]);
        // Re-add subject tds
        subjects.forEach(s => {
            const td = document.createElement('td');
            td.dataset.sid = s.id;
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.min = '0';
            inp.placeholder = '0';
            inp.value = existing[s.id] || '';
            td.appendChild(inp);
            tr.insertBefore(td, actionTd);
        });
    }

    function addStudentRow() {
        const tr = document.createElement('tr');
        const idx = inputBody.children.length + 1;
        // Num
        const numTd = document.createElement('td');
        numTd.className = 'num-cell';
        numTd.textContent = idx;
        tr.appendChild(numTd);
        // Name
        const nameTd = document.createElement('td');
        const nameInp = document.createElement('input');
        nameInp.type = 'text';
        nameInp.placeholder = 'Student name';
        nameTd.appendChild(nameInp);
        tr.appendChild(nameTd);
        // Subject cells
        subjects.forEach(s => {
            const td = document.createElement('td');
            td.dataset.sid = s.id;
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.min = '0';
            inp.placeholder = '0';
            td.appendChild(inp);
            tr.appendChild(td);
        });
        // Action
        const actTd = document.createElement('td');
        const btn = document.createElement('button');
        btn.className = 'remove-row';
        btn.textContent = '✕';
        btn.addEventListener('click', () => { tr.remove(); renumberRows(); });
        actTd.appendChild(btn);
        tr.appendChild(actTd);
        inputBody.appendChild(tr);
    }

    function renumberRows() {
        inputBody.querySelectorAll('tr').forEach((tr, i) => {
            tr.children[0].textContent = i + 1;
        });
    }

    $('add-row-btn').addEventListener('click', addStudentRow);

    // ===== EVALUATION =====
    $('evaluate-btn').addEventListener('click', evaluate);

    function evaluate() {
        const threshold = parseFloat($('pass-mark').value);
        if (isNaN(threshold)) { alert('Set a valid pass mark.'); return; }
        const rows = inputBody.querySelectorAll('tr');
        if (!rows.length) { alert('Add at least one student.'); return; }

        results = [];
        let hasErr = false;

        rows.forEach(tr => {
            const name = tr.children[1].querySelector('input').value.trim();
            if (!name) { hasErr = true; tr.children[1].querySelector('input').style.borderColor = 'var(--fail)'; return; }
            tr.children[1].querySelector('input').style.borderColor = '';

            const marks = {};
            let total = 0, allPass = true, subjPassed = 0;
            subjects.forEach(s => {
                const td = tr.querySelector(`td[data-sid="${s.id}"]`);
                const v = parseFloat(td.querySelector('input').value) || 0;
                marks[s.id] = v;
                total += v;
                if (v >= threshold) subjPassed++; else allPass = false;
            });

            const avg = subjects.length ? total / subjects.length : 0;
            const pct = subjects.length ? (total / (subjects.length * 100)) * 100 : 0;
            const grade = calcGrade(avg);

            results.push({ name, marks, total, avg, pct, grade, isPass: allPass, subjPassed, threshold });
        });

        if (hasErr) { alert('Fill in all student names.'); return; }

        // Rank by total descending
        results.sort((a, b) => b.total - a.total);
        results.forEach((r, i) => r.rank = i + 1);

        renderDashboard();
    }

    function calcGrade(avg) {
        if (avg >= 90) return 'A';
        if (avg >= 75) return 'B';
        if (avg >= 60) return 'C';
        if (avg >= 40) return 'D';
        return 'F';
    }

    // ===== DASHBOARD =====
    let currentFilter = 'all';

    function renderDashboard() {
        dashboard.classList.remove('hidden');
        dashboard.style.animation = 'none'; dashboard.offsetHeight; dashboard.style.animation = 'fadeUp .4s ease-out';

        // Stats
        const total = results.length;
        const passed = results.filter(r => r.isPass).length;
        const failed = total - passed;
        const avg = total ? (results.reduce((s, r) => s + r.avg, 0) / total).toFixed(1) : 0;
        const topper = results.length ? results[0].name : '—';

        $('stat-total').textContent = total;
        $('stat-pass').textContent = passed;
        $('stat-fail').textContent = failed;
        $('stat-avg').textContent = avg;
        $('stat-top').textContent = topper;

        rebuildResultsHeaders();
        renderResultsTable();
        dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function rebuildResultsHeaders() {
        resultsHeader.innerHTML = '';
        ['Rank', 'Student Name'].forEach(t => { const th = document.createElement('th'); th.textContent = t; resultsHeader.appendChild(th); });
        subjects.forEach(s => { const th = document.createElement('th'); th.textContent = s.name; resultsHeader.appendChild(th); });
        ['Total', 'Avg', 'Grade', 'Status'].forEach(t => { const th = document.createElement('th'); th.textContent = t; resultsHeader.appendChild(th); });
    }

    function renderResultsTable() {
        resultsBody.innerHTML = '';
        const filtered = currentFilter === 'all' ? results
            : currentFilter === 'passed' ? results.filter(r => r.isPass)
            : results.filter(r => !r.isPass);

        filtered.forEach(r => {
            const tr = document.createElement('tr');
            // Rank
            const rankTd = document.createElement('td');
            rankTd.className = `rank-cell ${r.rank <= 3 ? 'rank-' + r.rank : ''}`;
            rankTd.textContent = r.rank <= 3 ? ['🥇','🥈','🥉'][r.rank - 1] + ' #' + r.rank : '#' + r.rank;
            tr.appendChild(rankTd);
            // Name (clickable)
            const nameTd = document.createElement('td');
            const link = document.createElement('a');
            link.className = 'name-link';
            link.textContent = r.name;
            link.href = '#';
            link.addEventListener('click', e => { e.preventDefault(); openProfile(r); });
            nameTd.appendChild(link);
            tr.appendChild(nameTd);
            // Subject marks
            const threshold = r.threshold;
            subjects.forEach(s => {
                const td = document.createElement('td');
                const v = r.marks[s.id] ?? 0;
                td.textContent = v;
                td.className = v >= threshold ? 'mark-pass' : 'mark-fail';
                tr.appendChild(td);
            });
            // Total
            addTd(tr, r.total);
            // Avg
            addTd(tr, r.avg.toFixed(1));
            // Grade
            const gTd = document.createElement('td');
            gTd.innerHTML = `<span class="grade-badge grade-${r.grade.toLowerCase()}">${r.grade}</span>`;
            tr.appendChild(gTd);
            // Status
            const sTd = document.createElement('td');
            sTd.innerHTML = `<span class="status-pill ${r.isPass ? 'pill-pass' : 'pill-fail'}">${r.isPass ? 'PASS' : 'FAIL'}</span>`;
            tr.appendChild(sTd);

            resultsBody.appendChild(tr);
        });
    }

    function addTd(tr, val) { const td = document.createElement('td'); td.textContent = val; tr.appendChild(td); }

    // Tabs
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderResultsTable();
        });
    });

    $('clear-btn').addEventListener('click', () => { dashboard.classList.add('hidden'); results = []; });

    // ===== STUDENT PROFILE =====
    function openProfile(student) {
        profileOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        const r = student;
        $('profile-avatar').textContent = r.name.charAt(0).toUpperCase();
        $('profile-name').textContent = r.name;
        $('profile-rank').textContent = `#${r.rank}`;
        const statusEl = $('profile-status');
        statusEl.textContent = r.isPass ? 'PASSED' : 'FAILED';
        statusEl.className = `status-pill ${r.isPass ? 'pill-pass' : 'pill-fail'}`;

        $('p-total').textContent = r.total;
        $('p-average').textContent = r.avg.toFixed(1);
        $('p-percentage').textContent = r.pct.toFixed(1) + '%';
        $('p-grade').textContent = r.grade;
        $('p-subj-passed').textContent = `${r.subjPassed}/${subjects.length}`;

        renderBarChart(r);
        renderPieChart(r);
        renderSubjectBreakdown(r);
    }

    function closeProfile() {
        profileOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    }

    $('close-profile').addEventListener('click', closeProfile);
    $('profile-backdrop').addEventListener('click', closeProfile);

    // ===== CHARTS =====
    function getChartColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            text: isDark ? '#94a3b8' : '#475569',
            grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            pass: '#10b981',
            fail: '#ef4444',
            bar: '#6366f1',
            barBg: 'rgba(99,102,241,0.7)',
            threshLine: isDark ? 'rgba(239,68,68,0.6)' : 'rgba(220,38,38,0.6)',
        };
    }

    function renderBarChart(r) {
        const ctx = $('bar-chart').getContext('2d');
        if (barChart) barChart.destroy();
        const c = getChartColors();
        const labels = subjects.map(s => s.name);
        const data = subjects.map(s => r.marks[s.id] ?? 0);
        const bgColors = subjects.map(s => (r.marks[s.id] ?? 0) >= r.threshold ? c.pass : c.fail);

        barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Marks',
                    data,
                    backgroundColor: bgColors,
                    borderRadius: 4,
                    maxBarThickness: 36
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    annotation: undefined
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { color: c.text, font: { size: 10 } },
                        grid: { color: c.grid }
                    },
                    x: {
                        ticks: { color: c.text, font: { size: 10 } },
                        grid: { display: false }
                    }
                }
            },
            plugins: [{
                id: 'thresholdLine',
                afterDraw(chart) {
                    const yScale = chart.scales.y;
                    const y = yScale.getPixelForValue(r.threshold);
                    const ctx2 = chart.ctx;
                    ctx2.save();
                    ctx2.strokeStyle = c.threshLine;
                    ctx2.lineWidth = 2;
                    ctx2.setLineDash([6, 4]);
                    ctx2.beginPath();
                    ctx2.moveTo(chart.chartArea.left, y);
                    ctx2.lineTo(chart.chartArea.right, y);
                    ctx2.stroke();
                    ctx2.restore();
                }
            }]
        });
    }

    function renderPieChart(r) {
        const ctx = $('pie-chart').getContext('2d');
        if (pieChart) pieChart.destroy();
        const c = getChartColors();
        const passed = r.subjPassed;
        const failed = subjects.length - passed;

        pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Passed', 'Failed'],
                datasets: [{
                    data: [passed, failed],
                    backgroundColor: [c.pass, c.fail],
                    borderWidth: 0,
                    spacing: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: c.text, padding: 12, font: { size: 11 } }
                    }
                }
            }
        });
    }

    function renderSubjectBreakdown(r) {
        const list = $('subject-detail-list');
        list.innerHTML = '';
        subjects.forEach(s => {
            const v = r.marks[s.id] ?? 0;
            const pass = v >= r.threshold;
            const pct = Math.min(v, 100);
            const row = document.createElement('div');
            row.className = 'subj-row';
            row.innerHTML = `
                <span class="subj-name">${esc(s.name)}</span>
                <div class="subj-bar"><div class="subj-bar-fill ${pass ? 'pass' : 'fail'}" style="width:${pct}%"></div></div>
                <span class="subj-mark ${pass ? 'pass' : 'fail'}">${v}</span>
                <span class="subj-status ${pass ? 'pass' : 'fail'}">${pass ? 'Pass' : 'Fail'}</span>`;
            list.appendChild(row);
        });
    }

    // ===== UTILITY =====
    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
});
