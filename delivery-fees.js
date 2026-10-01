/* Taxas de entrega por bairro — base Socorro R$ 3,99 e +R$ 0,25 por faixa sequencial. */
(function () {
  const DELIVERY_FEES = [
    ["Socorro", 399],
    ["Pitombeira", 424],
    ["Brotolândia", 449],
    ["Centro", 474],
    ["Dr José Simões", 499],
    ["João XXIII", 524],
    ["Monsenhor Otávio", 549],
    ["Santa Luzia", 574],
    ["Antônio Holanda", 599],
    ["Bom Jesus", 624],
    ["Limoeirinho", 649],
    ["Bom Nome", 674],
    ["Boa Fé", 699],
    ["Luis Alves de Freitas", 724],
    ["Ilha", 749],
    ["Bom Jesus do Cruzeiro", 774],
  ];

  const moneyFromCents = (cents) => (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  function selectedDelivery() {
    const value = document.getElementById("deliveryNeighborhood")?.value || "";
    const match = DELIVERY_FEES.find(([name]) => name === value);
    return match ? { neighborhood: match[0], cents: match[1] } : null;
  }

  function addStyles() {
    if (document.getElementById("uba-delivery-fees-css")) return;
    const style = document.createElement("style");
    style.id = "uba-delivery-fees-css";
    style.textContent = `
      .delivery-fee-box{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 13px;border:1px solid #4B3868;border-radius:14px;background:linear-gradient(145deg,#171222,#100D18)}
      .delivery-fee-box b{display:block;color:var(--text);font-size:12px}.delivery-fee-box small{display:block;margin-top:3px;color:var(--muted);font-size:9px;line-height:1.35}.delivery-fee-value{white-space:nowrap;color:#D9C2FF;font-size:16px;font-weight:1000}
      .delivery-pix-breakdown{margin:0 0 12px;padding:12px 13px;border:1px solid var(--line);border-radius:14px;background:var(--surface2)}
      .delivery-pix-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 0;color:var(--muted);font-size:10px}.delivery-pix-row b{color:var(--text)}
      .delivery-pix-row.total{margin-top:5px;padding-top:9px;border-top:1px solid var(--line);font-size:12px;font-weight:1000}.delivery-pix-row.total span,.delivery-pix-row.total b{color:#D9C2FF}
    `;
    document.head.appendChild(style);
  }

  function ensureDeliveryUi() {
    addStyles();
    const step3 = document.getElementById("step3");
    const fields = step3?.querySelector(".fields");
    if (!fields) return;

    if (!document.getElementById("deliveryNeighborhood")) {
      const cityField = document.getElementById("deliveryCity")?.closest(".field");
      const field = document.createElement("div");
      field.className = "field";
      field.innerHTML = `<label for="deliveryNeighborhood">Bairro</label><select id="deliveryNeighborhood" autocomplete="address-level3"><option value="">Selecione o bairro</option>${DELIVERY_FEES.map(([name, cents]) => `<option value="${name}">${name} — ${moneyFromCents(cents)}</option>`).join("")}</select>`;
      if (cityField) cityField.after(field);
      else fields.prepend(field);

      const saved = sessionStorage.getItem("uba-rev-delivery-neighborhood") || "";
      const select = field.querySelector("select");
      if (DELIVERY_FEES.some(([name]) => name === saved)) select.value = saved;
      select.addEventListener("change", () => {
        sessionStorage.setItem("uba-rev-delivery-neighborhood", select.value || "");
        const city = document.getElementById("deliveryCity");
        if (select.value && city && !city.value.trim()) city.value = "Limoeiro do Norte";
        updateDeliverySummary();
      });
    }

    if (!document.getElementById("deliveryFeeBox")) {
      const feeBox = document.createElement("div");
      feeBox.id = "deliveryFeeBox";
      feeBox.className = "delivery-fee-box";
      feeBox.innerHTML = `<div><b>Taxa de entrega</b><small>Base saindo do Conviver Loteamentos. Socorro começa em R$ 3,99 e cada bairro seguinte soma R$ 0,25.</small></div><div class="delivery-fee-value" id="deliveryFeeValue">Selecione o bairro</div>`;
      fields.appendChild(feeBox);
    }

    const step4 = document.getElementById("step4");
    const generate = document.getElementById("generatePixArea");
    if (step4 && generate && !document.getElementById("deliveryPixBreakdown")) {
      const breakdown = document.createElement("div");
      breakdown.id = "deliveryPixBreakdown";
      breakdown.className = "delivery-pix-breakdown";
      breakdown.innerHTML = `
        <div class="delivery-pix-row"><span>Produtos</span><b id="deliveryProductsTotal">—</b></div>
        <div class="delivery-pix-row"><span>Entrega · <span id="deliveryPixNeighborhood">bairro</span></span><b id="deliveryPixFee">—</b></div>
        <div class="delivery-pix-row total"><span>Total no Pix</span><b id="deliveryPixTotal">—</b></div>
      `;
      generate.before(breakdown);
    }
  }

  function updateDeliverySummary() {
    ensureDeliveryUi();
    const delivery = selectedDelivery();
    const feeValue = document.getElementById("deliveryFeeValue");
    if (feeValue) feeValue.textContent = delivery ? moneyFromCents(delivery.cents) : "Selecione o bairro";

    let productTotal = null;
    let showPrice = true;
    try {
      const totals = typeof getTotals === "function" ? getTotals() : null;
      if (totals && Number.isFinite(Number(totals.total))) productTotal = Number(totals.total);
      if (typeof canSeePrices === "function") showPrice = Boolean(canSeePrices());
    } catch {}

    const productEl = document.getElementById("deliveryProductsTotal");
    const feeEl = document.getElementById("deliveryPixFee");
    const neighborhoodEl = document.getElementById("deliveryPixNeighborhood");
    const totalEl = document.getElementById("deliveryPixTotal");
    const pixTotal = document.getElementById("pixTotal");

    if (neighborhoodEl) neighborhoodEl.textContent = delivery?.neighborhood || "bairro";
    if (feeEl) feeEl.textContent = delivery ? moneyFromCents(delivery.cents) : "—";

    if (productTotal !== null && showPrice) {
      const totalCents = Math.round(productTotal * 100) + (delivery?.cents || 0);
      if (productEl) productEl.textContent = moneyFromCents(Math.round(productTotal * 100));
      if (totalEl) totalEl.textContent = delivery ? moneyFromCents(totalCents) : "Selecione o bairro";
      if (pixTotal && delivery) pixTotal.textContent = moneyFromCents(totalCents);
    } else {
      if (productEl) productEl.textContent = "—";
      if (totalEl) totalEl.textContent = "—";
    }
  }

  const baseGoStep = window.goStep;
  if (typeof baseGoStep === "function") {
    window.goStep = function (step) {
      ensureDeliveryUi();
      if (Number(step) === 4 && !selectedDelivery()) {
        alert("Selecione o bairro para calcular a taxa de entrega antes de ir para o Pix.");
        return;
      }
      const result = baseGoStep.apply(this, arguments);
      setTimeout(updateDeliverySummary, 0);
      return result;
    };
  }

  const baseUpdateCart = window.updateCart;
  if (typeof baseUpdateCart === "function") {
    window.updateCart = function () {
      const result = baseUpdateCart.apply(this, arguments);
      updateDeliverySummary();
      return result;
    };
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init = {}) {
    try {
      const rawUrl = typeof input === "string" ? input : input?.url || "";
      const url = new URL(rawUrl, window.location.origin);
      const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
      if (url.pathname === "/api/orders" && method === "POST" && typeof init?.body === "string") {
        const delivery = selectedDelivery();
        const payload = JSON.parse(init.body || "{}");
        if (delivery && payload && typeof payload === "object") {
          payload.delivery = payload.delivery && typeof payload.delivery === "object" ? payload.delivery : {};
          payload.delivery.neighborhood = delivery.neighborhood;
          init = { ...init, body: JSON.stringify(payload) };
        }
      }
    } catch {}
    return nativeFetch(input, init);
  };

  ensureDeliveryUi();
  updateDeliverySummary();
  const observer = new MutationObserver(() => ensureDeliveryUi());
  observer.observe(document.body, { childList: true, subtree: true });
})();
