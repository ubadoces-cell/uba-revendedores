/* Taxas de entrega por bairro — base Socorro R$ 1,99 e +R$ 0,25 por faixa sequencial. */
(function () {
  const DELIVERY_FEES = [
    ["Socorro", 199],
    ["Pitombeira", 224],
    ["Brotolândia", 249],
    ["Centro", 274],
    ["Dr José Simões", 299],
    ["João XXIII", 324],
    ["Monsenhor Otávio", 349],
    ["Santa Luzia", 374],
    ["Antônio Holanda", 399],
    ["Bom Jesus", 424],
    ["Limoeirinho", 449],
    ["Bom Nome", 474],
    ["Boa Fé", 499],
    ["Luis Alves de Freitas", 524],
    ["Ilha", 549],
    ["Bom Jesus do Cruzeiro", 574],
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

  function ensureDeliveryUi() {
    const step3 = document.getElementById("step3");
    const fields = step3?.querySelector(".fields");
    if (!fields) return;

    let select = document.getElementById("deliveryNeighborhood");
    if (!select) {
      const cityField = document.getElementById("deliveryCity")?.closest(".field");
      const field = document.createElement("div");
      field.className = "field";
      field.innerHTML = `<label for="deliveryNeighborhood">Bairro</label><select id="deliveryNeighborhood" autocomplete="address-level3"><option value="">Selecione o bairro</option>${DELIVERY_FEES.map(([name]) => `<option value="${name}">${name}</option>`).join("")}</select>`;
      if (cityField) cityField.after(field);
      else fields.prepend(field);
      select = field.querySelector("select");
    } else {
      const current = select.value;
      select.innerHTML = `<option value="">Selecione o bairro</option>${DELIVERY_FEES.map(([name]) => `<option value="${name}">${name}</option>`).join("")}`;
      if (DELIVERY_FEES.some(([name]) => name === current)) select.value = current;
    }

    if (!select.dataset.ubaDeliveryBound) {
      const saved = sessionStorage.getItem("uba-rev-delivery-neighborhood") || "";
      if (DELIVERY_FEES.some(([name]) => name === saved)) select.value = saved;
      select.addEventListener("change", () => {
        sessionStorage.setItem("uba-rev-delivery-neighborhood", select.value || "");
        const city = document.getElementById("deliveryCity");
        if (select.value && city && !city.value.trim()) city.value = "Limoeiro do Norte";
        updateDeliveryTotal();
      });
      select.dataset.ubaDeliveryBound = "1";
    }

    document.getElementById("deliveryFeeBox")?.remove();
    document.getElementById("deliveryFeePrivacyNote")?.remove();
    document.getElementById("deliveryPixBreakdown")?.remove();
    document.getElementById("ubaPixLoading")?.remove();
  }

  function updateDeliveryTotal() {
    ensureDeliveryUi();
    const delivery = selectedDelivery();
    let productTotal = null;
    let showPrice = true;
    try {
      const totals = typeof getTotals === "function" ? getTotals() : null;
      if (totals && Number.isFinite(Number(totals.total))) productTotal = Number(totals.total);
      if (typeof canSeePrices === "function") showPrice = Boolean(canSeePrices());
    } catch {}

    const pixTotal = document.getElementById("pixTotal");
    if (pixTotal && productTotal !== null && showPrice) {
      const totalCents = Math.round(productTotal * 100) + (delivery?.cents || 0);
      pixTotal.textContent = moneyFromCents(totalCents);
    }
  }

  const baseGoStep = window.goStep;
  if (typeof baseGoStep === "function") {
    window.goStep = function (step) {
      ensureDeliveryUi();
      if (Number(step) === 4 && !selectedDelivery()) {
        alert("Selecione o bairro antes de ir para o Pix.");
        return;
      }
      const result = baseGoStep.apply(this, arguments);
      setTimeout(updateDeliveryTotal, 0);
      return result;
    };
  }

  const baseUpdateCart = window.updateCart;
  if (typeof baseUpdateCart === "function") {
    window.updateCart = function () {
      const result = baseUpdateCart.apply(this, arguments);
      updateDeliveryTotal();
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
  updateDeliveryTotal();
})();
