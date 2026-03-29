/* features*/
const predictBtn  = document.getElementById("predictBtn");
const loadingEl   = document.getElementById("loading");
const resultPanel = document.getElementById("resultPanel");
const resultLevel = document.getElementById("resultLevel");
const resultDesc  = document.getElementById("resultDesc");
const topFeatures = document.getElementById("topFeatures");
const navbar      = document.getElementById("navbar");
const heroRing    = document.getElementById("hring");
const heroPct     = document.getElementById("hpct");
const ringArc     = document.getElementById("ringArc");
const ringPct     = document.getElementById("ringPct");


/* coding sliders*/

function updateSlider(input){
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const val = parseFloat(input.value);
    const pct = ((val-min)/(max-min))*100;

    input.style.background = `linear-gradient(to right, var(--blue) ${pct}%, rgba(255,255,255,0.10) ${pct}%)`;

    /* live value*/
    const badge = document.getElementById("val-"+input.id);
    if (badge){
        const decimals = parseFloat(input.step) <1? 2:1;
        badge.textContent = parseFloat(val.toFixed(decimals));
    }
}

document.querySelectorAll(".slider").forEach(input=>{
    updateSlider(input);
    input.addEventListener("input", () =>updateSlider(input));
});

/* navbar shadow effect */
if (navbar) {
    window.addEventListener("scroll", () => {
        navbar.style.background = window.scrollY > 40
            ? "rgba(7,17,34,0.95)"
            : "rgba(7,17,34,0.70)";
    }, { passive: true });
}

/* risk level*/
function riskMeta(pct) {
    if (pct < 10) return { label: "Minimal Bleaching",  cls: "risk-low",    color: "#1ab3eb" };
    if (pct < 30) return { label: "Low Bleaching",      cls: "risk-low",    color: "#1ab3eb" };
    if (pct < 60) return { label: "Moderate Bleaching", cls: "risk-medium", color: "#fbbf24" };
    return              { label: "Severe Bleaching",    cls: "risk-high",   color: "#ef4444" };
}

/* risk ring*/
const RING = 283;

function animateGauge(targetPct) {
    if (!ringArc || !ringPct) return;

    const clamped    = Math.max(0, Math.min(100, targetPct));
    const meta       = riskMeta(clamped);
    const targetDash = (clamped / 100) * RING;
    let start = null;

    function step(ts) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / 1200, 1);
        const ease = 1 - Math.pow(1 - progress, 3);

        ringArc.setAttribute("stroke-dasharray", 
            `${targetDash * ease} ${RING}`);
        ringPct.textContent = Math.round(clamped * ease) + "%";

        // Mirror to hero ring
        if (heroPct) heroPct.textContent = Math.round(clamped * ease) + "%";

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            if (heroRing) heroRing.style.borderColor = meta.color + "55";
            if (heroPct)  heroPct.style.color = meta.color;
        }
    }
    requestAnimationFrame(step);
}

function collectFeatures() {
    const features = {};

    document.querySelectorAll(".slider").forEach(input => {
        features[input.id] = parseFloat(input.value);
    });

    document.querySelectorAll("input[type='hidden'][data-feature]").forEach(input => {
        features[input.dataset.feature] = parseFloat(input.value);
    });

    return features;
}

function showError(msg) {
    let el = document.getElementById("csErrorMsg");
    if (!el) {
        el = document.createElement("p");
        el.id = "csErrorMsg";
        el.style.cssText =
            "color:#ef4444;font-size:0.8rem;text-align:center;margin-top:1rem;";
        document.querySelector(".predict-section").appendChild(el);
    }
    el.textContent = "⚠ " + msg;
}

function clearError() {
    const el = document.getElementById("csErrorMsg");
    if (el) el.textContent = "";
}

if (predictBtn) {
    predictBtn.addEventListener("click", async () => {
        clearError();

        // Loading state
        predictBtn.disabled = true;
        predictBtn.querySelector(".btn-text").textContent = "Running inference…";
        if (loadingEl)   loadingEl.classList.add("visible");
        if (resultPanel) resultPanel.style.display = "none";

        const features = collectFeatures();
        console.log("Sending:", features); // helpful for debugging

        try {
            const response = await fetch("/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(features),
            });

            const data = await response.json();
            console.log("Response:", data); // helpful for debugging

            if (!response.ok || data.error) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            const bleachPct = parseFloat(data.bleaching_percent);
            const meta      = riskMeta(bleachPct);

            // Show result panel
            resultPanel.style.display = "";
            resultPanel.getBoundingClientRect(); // force reflow
            resultPanel.classList.add("visible");

            // Update text
            resultLevel.textContent = meta.label;
            resultLevel.className   = `result-level ${meta.cls}`;
            resultDesc.textContent  = descriptionFor(bleachPct);

            // Animate gauge
            animateGauge(bleachPct);

            // Feature bars if returned
            if (data.feature_importances) {
                renderFeatureBars(data.feature_importances);
            }

            resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });

        } catch (err) {
            showError(err.message);
            console.error(err);
        } finally {
            predictBtn.disabled = false;
            predictBtn.querySelector(".btn-text").textContent = "Predict Bleaching %";
            if (loadingEl) loadingEl.classList.remove("visible");
        }
    });
}

function descriptionFor(pct) {
    if (pct < 10) return "Reef conditions appear healthy. Bleaching risk is very low.";
    if (pct < 30) return "Low-level bleaching detected. Recovery is likely under normal conditions.";
    if (pct < 60) return "Moderate bleaching expected. Sustained thermal stress is affecting the reef.";
    return "Severe bleaching predicted. Immediate intervention is critical.";
}

function renderFeatureBars(importances) {
    if (!topFeatures) return;
    topFeatures.innerHTML = "";

    const sorted = Object.entries(importances)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (!sorted.length) return;

    const maxVal = sorted[0][1];

    const heading = document.createElement("h4");
    heading.textContent = "Top Contributing Features";
    topFeatures.appendChild(heading);

    sorted.forEach(([name, val]) => {
        const widthPct = ((val / maxVal) * 100).toFixed(1);
        const row = document.createElement("div");
        row.className = "feat-bar-row";
        row.innerHTML = `
            <span class="feat-bar-label">${name.replace(/_/g, " ")}</span>
            <div class="feat-bar-track">
                <div class="feat-bar-fill" 
                     style="width:0%" 
                     data-target="${widthPct}">
                </div>
            </div>`;
        topFeatures.appendChild(row);
    });

    requestAnimationFrame(() => {
        topFeatures.querySelectorAll(".feat-bar-fill").forEach(bar => {
            bar.style.width = bar.dataset.target + "%";
        });
    });
}