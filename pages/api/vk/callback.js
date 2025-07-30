
export default function handler(req, res) {
  const { code, device_id } = req.query;
  console.log("Получен код от VK:", code, "Device ID:", device_id);
  res.status(200).json({ ok: true });
}
