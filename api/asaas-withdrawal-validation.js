export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  // Esta loja não solicita transferências, pagamentos ou saques pela API.
  // Recusar por padrão impede que uma chave comprometida retire dinheiro.
  return res.status(200).json({
    status: "REFUSED",
    refuseReason: "Operações de saída pela API não são autorizadas pela UBA Doces.",
  });
}
