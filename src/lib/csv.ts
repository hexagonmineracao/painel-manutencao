function escapeCsvValue(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Exporta como CSV com separador ";" (padrão do Excel em pt-BR) e BOM UTF-8
// para acentos aparecerem corretos ao abrir direto no Excel.
export function exportToCsv(filename: string, headers: string[], rows: unknown[][]) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(';'))
  const csv = '﻿' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
