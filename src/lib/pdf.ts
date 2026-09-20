import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportToPdf(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: unknown[][],
) {
  const doc = new jsPDF({ orientation: 'landscape' })

  doc.setFontSize(14)
  doc.text(title, 14, 15)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(subtitle, 14, 21)

  autoTable(doc, {
    startY: 26,
    head: [headers],
    body: rows.map((row) => row.map((v) => (v == null ? '' : String(v)))),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 95] },
  })

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}
