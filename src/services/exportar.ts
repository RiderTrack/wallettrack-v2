// ═══════════════════════════════════════════════════════════
// 📤 EXPORTAR — WalletTrack V2 (F3 · ANÁLISIS)
// Puerto del exportExcel()/exportPDF() del viejo (ExcelJS +
// jsPDF/autotable). El viejo los cargaba por CDN; acá son
// dependencias npm con import DINÁMICO → Vite los deja como
// chunks separados que solo se descargan al exportar (la app
// principal no engorda y en el APK funcionan 100 % offline).
// Hojas Excel: Transacciones · Presupuestos · Metas · Resumen
// Mensual · Saldos por Cuenta (mismas 5 del original, con los
// mismos colores y formatos "S/ #,##0.00").
// ═══════════════════════════════════════════════════════════

import type { Border, Borders, Cell, Fill, Font, Row } from 'exceljs'; // solo tipos (se borran al compilar)
import type { EstadoWallet } from '../types';
import { todasLasCuentas } from '../data/catalogos';
import { gastosDelMesPorCategoria, resumenMeses, saldoTotal } from './estado';
import { hoyISO, mesActualISO, nombreMesActual } from './dinero';
import { compartirArchivo } from './archivo';

// ── Helpers de estilo (idénticos al exportExcel del viejo) ────
function fill(hex: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } };
}
function borde(c?: string): Partial<Borders> {
  const s: Border = { style: 'thin', color: { argb: `FF${c || 'BDBDBD'}` } };
  return { top: s, bottom: s, left: s, right: s };
}
function fB(hex: string, sz?: number): Font {
  return { bold: true, color: { argb: `FF${hex}` }, size: sz || 10, name: 'Calibri' } as Font;
}
function fN(hex: string, sz?: number): Font {
  return { color: { argb: `FF${hex}` }, size: sz || 10, name: 'Calibri' } as Font;
}

/** Aplica relleno + borde a cada celda de una fila y deja que el llamador ajuste el resto */
function estiloFila(fila: Row, bgHex: string, fn: (celda: Cell, col: number) => void): void {
  fila.eachCell((celda, col) => {
    celda.style = { ...(celda.style || {}), fill: fill(bgHex), border: borde('BDBDBD') };
    fn(celda, col);
  });
}

// ═══════════════════════════════════════════════════════════
// 📊 EXCEL — 5 hojas con colores (puerto del exportExcel)
// ═══════════════════════════════════════════════════════════

export async function exportarExcel(estado: EstadoWallet): Promise<void> {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WalletTrack';
  wb.created = new Date();

  const mesActual = mesActualISO();
  const mesLabel = nombreMesActual();
  const mesCap = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  // ── HOJA 1: TRANSACCIONES ──
  const ws1 = wb.addWorksheet('Transacciones', { views: [{ state: 'frozen', ySplit: 3 }] });
  ws1.columns = [{ width: 12 }, { width: 10 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 36 }];

  const titRow = ws1.addRow(['WALLETTRACK — Historial de Movimientos — ' + mesCap, '', '', '', '', '']);
  ws1.mergeCells(titRow.number, 1, titRow.number, 6);
  titRow.getCell(1).style = {
    fill: fill('0F172A'), font: fB('10B981', 14), alignment: { horizontal: 'center', vertical: 'middle' },
  };
  titRow.height = 28;
  ws1.addRow([]).height = 4;

  const hdr1 = ws1.addRow(['Fecha', 'Tipo', 'Categoría', 'Cuenta', 'Monto (S/)', 'Descripción']);
  hdr1.height = 20;
  hdr1.eachCell((celda) => {
    celda.style = {
      fill: fill('10B981'), font: fB('FFFFFF', 11),
      alignment: { horizontal: 'center', vertical: 'middle' }, border: borde('065F46'),
    };
  });
  ws1.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 6 } };

  let ingrIdx = 0, gasIdx = 0;
  estado.transactions.forEach((t) => {
    const cuenta = todasLasCuentas(estado).find((c) => c.id === (t.account || 'efectivo'))?.name || t.account;
    const esIngreso = t.type === 'income';
    const fila = ws1.addRow([
      t.date || '', esIngreso ? 'Ingreso' : 'Gasto', t.category || '', cuenta || '',
      Number(t.amount), t.description || '',
    ]);
    fila.height = 15;
    const bgHex = esIngreso ? (ingrIdx++ % 2 === 0 ? 'D1FAE5' : 'A7F3D0') : (gasIdx++ % 2 === 0 ? 'FEE2E2' : 'FECACA');
    estiloFila(fila, bgHex, (celda, col) => {
      if (col === 5) {
        celda.style = { ...celda.style, font: fB(esIngreso ? '065F46' : '991B1B', 10), alignment: { horizontal: 'right', vertical: 'middle' }, numFmt: '"S/ "#,##0.00' };
      } else if (col === 2) {
        celda.style = { ...celda.style, font: fB(esIngreso ? '065F46' : '991B1B', 10), alignment: { horizontal: 'center', vertical: 'middle' } };
      } else {
        celda.style = { ...celda.style, font: fN('1E293B', 10), alignment: { vertical: 'middle' } };
      }
    });
  });

  let totI = 0, totG = 0;
  estado.transactions.forEach((t) => {
    if (t.type === 'income') totI += Number(t.amount); else totG += Number(t.amount);
  });
  ws1.addRow([]).height = 6;
  const totRow = ws1.addRow(['', '', '', 'TOTALES', totI, -totG]);
  totRow.height = 18;
  totRow.eachCell((celda, col) => {
    celda.style = { fill: fill('0F172A'), font: fB('FFFFFF', 11), border: borde('10B981') };
    if (col === 5) celda.style = { ...celda.style, font: fB('34D399', 11), numFmt: '"S/ "#,##0.00', alignment: { horizontal: 'right' } };
    if (col === 6) celda.style = { ...celda.style, font: fB('FB7185', 11), numFmt: '"S/ "#,##0.00', alignment: { horizontal: 'right' } };
  });

  // ── HOJA 2: PRESUPUESTOS ──
  const ws2 = wb.addWorksheet('Presupuestos');
  ws2.columns = [{ width: 20 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 12 }];
  const titP = ws2.addRow(['PRESUPUESTOS — ' + mesCap, '', '', '', '']);
  ws2.mergeCells(titP.number, 1, titP.number, 5);
  titP.getCell(1).style = { fill: fill('6366F1'), font: fB('FFFFFF', 14), alignment: { horizontal: 'center', vertical: 'middle' } };
  titP.height = 28;
  ws2.addRow([]).height = 4;
  const hdr2 = ws2.addRow(['Categoría', 'Límite (S/)', 'Consumido (S/)', 'Disponible (S/)', '% Usado']);
  hdr2.height = 20;
  hdr2.eachCell((celda) => {
    celda.style = {
      fill: fill('6366F1'), font: fB('FFFFFF', 11),
      alignment: { horizontal: 'center', vertical: 'middle' }, border: borde('4338CA'),
    };
  });

  const gastosCat = gastosDelMesPorCategoria(estado, mesActual);
  estado.budgets.forEach((b) => {
    const gastado = gastosCat[b.category] || 0;
    const restante = b.limit - gastado;
    const pct = b.limit > 0 ? parseFloat(((gastado / b.limit) * 100).toFixed(1)) : 0;
    const bgHex = pct >= 100 ? 'FEE2E2' : pct >= 80 ? 'FEF3C7' : 'ECFDF5';
    const fila = ws2.addRow([b.category, b.limit, parseFloat(gastado.toFixed(2)), parseFloat(restante.toFixed(2)), pct]);
    fila.height = 16;
    estiloFila(fila, bgHex, (celda, col) => {
      if (col === 2 || col === 3 || col === 4) {
        celda.style = { ...celda.style, font: fN(restante < 0 ? '991B1B' : '065F46', 10), numFmt: '"S/ "#,##0.00', alignment: { horizontal: 'right', vertical: 'middle' } };
      } else if (col === 5) {
        celda.style = { ...celda.style, font: fB(pct >= 100 ? '991B1B' : pct >= 80 ? '92400E' : '065F46', 10), alignment: { horizontal: 'center', vertical: 'middle' }, numFmt: '0.0"%"' };
      } else {
        celda.style = { ...celda.style, font: fN('1E293B', 10), alignment: { vertical: 'middle' } };
      }
    });
  });

  // ── HOJA 3: METAS DE AHORRO ──
  const ws3 = wb.addWorksheet('Metas de Ahorro');
  ws3.columns = [{ width: 26 }, { width: 16 }, { width: 18 }, { width: 16 }, { width: 12 }, { width: 16 }];
  const titM = ws3.addRow(['METAS DE AHORRO', '', '', '', '', '']);
  ws3.mergeCells(titM.number, 1, titM.number, 6);
  titM.getCell(1).style = { fill: fill('F59E0B'), font: fB('FFFFFF', 14), alignment: { horizontal: 'center', vertical: 'middle' } };
  titM.height = 28;
  ws3.addRow([]).height = 4;
  const hdr3 = ws3.addRow(['Meta', 'Objetivo (S/)', 'Acumulado (S/)', 'Faltante (S/)', 'Progreso %', 'Fecha Límite']);
  hdr3.height = 20;
  hdr3.eachCell((celda) => {
    celda.style = {
      fill: fill('F59E0B'), font: fB('FFFFFF', 11),
      alignment: { horizontal: 'center', vertical: 'middle' }, border: borde('B45309'),
    };
  });

  estado.goals.forEach((g) => {
    const pct = g.target > 0 ? parseFloat(((g.current / g.target) * 100).toFixed(1)) : 0;
    const bgHex = pct >= 100 ? 'D1FAE5' : pct >= 50 ? 'FEF3C7' : 'F1F5F9';
    const fila = ws3.addRow([g.name, g.target, g.current, parseFloat((g.target - g.current).toFixed(2)), pct, g.date || '']);
    fila.height = 16;
    estiloFila(fila, bgHex, (celda, col) => {
      if (col === 2 || col === 3 || col === 4) {
        celda.style = { ...celda.style, numFmt: '"S/ "#,##0.00', font: fN('1E293B', 10), alignment: { horizontal: 'right', vertical: 'middle' } };
      } else if (col === 5) {
        celda.style = { ...celda.style, font: fB(pct >= 100 ? '065F46' : '92400E', 10), alignment: { horizontal: 'center', vertical: 'middle' }, numFmt: '0.0"%"' };
      } else {
        celda.style = { ...celda.style, font: fN('1E293B', 10), alignment: { vertical: 'middle' } };
      }
    });
  });

  // ── HOJA 4: RESUMEN MENSUAL ──
  const ws4 = wb.addWorksheet('Resumen Mensual');
  ws4.columns = [{ width: 16 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 16 }];
  const titR = ws4.addRow(['RESUMEN MENSUAL — Evolución Financiera', '', '', '', '']);
  ws4.mergeCells(titR.number, 1, titR.number, 5);
  titR.getCell(1).style = { fill: fill('0EA5E9'), font: fB('FFFFFF', 14), alignment: { horizontal: 'center', vertical: 'middle' } };
  titR.height = 28;
  ws4.addRow([]).height = 4;
  const hdr4 = ws4.addRow(['Mes', 'Ingresos (S/)', 'Gastos (S/)', 'Ahorro (S/)', 'Tasa Ahorro %']);
  hdr4.height = 20;
  hdr4.eachCell((celda) => {
    celda.style = {
      fill: fill('0EA5E9'), font: fB('FFFFFF', 11),
      alignment: { horizontal: 'center', vertical: 'middle' }, border: borde('0369A1'),
    };
  });

  resumenMeses(estado).forEach((m) => {
    const bgHex = m.pctAhorro >= 20 ? 'D1FAE5' : m.pctAhorro >= 0 ? 'FEF9C3' : 'FEE2E2';
    const fila = ws4.addRow([
      m.label, parseFloat(m.ingresos.toFixed(2)), parseFloat(m.gastos.toFixed(2)),
      parseFloat(m.ahorro.toFixed(2)), parseFloat(m.pctAhorro.toFixed(1)),
    ]);
    fila.height = 16;
    estiloFila(fila, bgHex, (celda, col) => {
      if (col === 2) celda.style = { ...celda.style, font: fB('065F46', 10), numFmt: '"S/ "#,##0.00', alignment: { horizontal: 'right', vertical: 'middle' } };
      else if (col === 3) celda.style = { ...celda.style, font: fB('991B1B', 10), numFmt: '"S/ "#,##0.00', alignment: { horizontal: 'right', vertical: 'middle' } };
      else if (col === 4) celda.style = { ...celda.style, font: fN(m.ahorro >= 0 ? '065F46' : '991B1B', 10), numFmt: '"S/ "#,##0.00', alignment: { horizontal: 'right', vertical: 'middle' } };
      else if (col === 5) celda.style = { ...celda.style, font: fB(m.pctAhorro >= 20 ? '065F46' : '92400E', 10), alignment: { horizontal: 'center', vertical: 'middle' }, numFmt: '0.0"%"' };
      else celda.style = { ...celda.style, font: fN('1E293B', 10), alignment: { vertical: 'middle' } };
    });
  });

  // ── HOJA 5: SALDOS POR CUENTA ──
  const ws5 = wb.addWorksheet('Saldos por Cuenta');
  ws5.columns = [{ width: 18 }, { width: 18 }, { width: 16 }, { width: 14 }, { width: 18 }];
  const titC = ws5.addRow(['SALDOS POR CUENTA', '', '', '', '']);
  ws5.mergeCells(titC.number, 1, titC.number, 5);
  titC.getCell(1).style = { fill: fill('0F172A'), font: fB('38BDF8', 14), alignment: { horizontal: 'center', vertical: 'middle' } };
  titC.height = 28;
  ws5.addRow([]).height = 4;
  const hdr5 = ws5.addRow(['Cuenta', 'Saldo Inicial (S/)', 'Ingresos (S/)', 'Gastos (S/)', 'Saldo Actual (S/)']);
  hdr5.height = 20;
  hdr5.eachCell((celda) => {
    celda.style = {
      fill: fill('0F172A'), font: fB('38BDF8', 11),
      alignment: { horizontal: 'center', vertical: 'middle' }, border: borde('0EA5E9'),
    };
  });

  let totalActual = 0;
  todasLasCuentas(estado).forEach((cuenta, ci) => {
    const inicial = Number(estado.saldosIniciales[cuenta.id] || 0);
    let ing = 0, gas = 0;
    estado.transactions.forEach((t) => {
      if ((t.account || 'efectivo') !== cuenta.id) return;
      if (t.type === 'income') ing += Number(t.amount); else gas += Number(t.amount);
    });
    const actual = inicial + ing - gas;
    totalActual += actual;
    const bgHex = actual >= 0 ? (ci % 2 === 0 ? 'F0FDF4' : 'DCFCE7') : (ci % 2 === 0 ? 'FFF1F2' : 'FFE4E6');
    const fila = ws5.addRow([`${cuenta.icon} ${cuenta.name}`, inicial, ing, gas, actual]);
    fila.height = 16;
    estiloFila(fila, bgHex, (celda, col) => {
      if (col >= 2) celda.style = { ...celda.style, numFmt: '"S/ "#,##0.00', alignment: { horizontal: 'right', vertical: 'middle' } };
      if (col === 5) celda.style = { ...celda.style, font: fB(actual >= 0 ? '065F46' : '991B1B', 10) };
      else if (col === 1) celda.style = { ...celda.style, font: fN('1E293B', 11), alignment: { vertical: 'middle' } };
      else celda.style = { ...celda.style, font: fN('1E293B', 10) };
    });
  });
  ws5.addRow([]).height = 4;
  const totalInicial = Object.values(estado.saldosIniciales || {}).reduce((a, v) => a + (Number(v) || 0), 0);
  const totC = ws5.addRow(['TOTAL', totalInicial, '', '', totalActual]);
  totC.height = 20;
  totC.eachCell((celda, col) => {
    celda.style = { fill: fill('0F172A'), font: fB('FFFFFF', 12), border: borde('38BDF8') };
    if (col === 2 || col === 5) celda.style = { ...celda.style, numFmt: '"S/ "#,##0.00', alignment: { horizontal: 'right', vertical: 'middle' } };
    if (col === 5) celda.style = { ...celda.style, font: fB(totalActual >= 0 ? '34D399' : 'FB7185', 12) };
  });

  // ── Compartir (Capacitor en APK, descarga en web) ──
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await compartirArchivo(blob, `WalletTrack_${hoyISO()}.xlsx`);
}

// ═══════════════════════════════════════════════════════════
// 📄 PDF — reporte financiero (puerto del exportPDF)
// ═══════════════════════════════════════════════════════════

export async function exportarPDF(estado: EstadoWallet): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const mesActual = mesActualISO();
  const mesLabel = nombreMesActual();
  const mesCap = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);
  const ahora = new Date().toLocaleDateString('es-PE');

  // ── Encabezado (fondo oscuro + franja esmeralda, como el viejo) ──
  doc.setFillColor(9, 13, 22);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('WalletTrack', 14, 12);
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.text('Reporte Financiero Personal', 14, 19);
  doc.text('Generado: ' + ahora, 14, 24);
  doc.setFontSize(11);
  doc.setFont('Helvetica', 'bold');
  doc.text(mesCap, 210 - 14, 17, { align: 'right' });

  // ── Balance general ──
  let ingMes = 0, gasMes = 0;
  estado.transactions.forEach((t) => {
    const m = (t.date || '').substring(0, 7);
    if (t.type === 'income') { if (m === mesActual) ingMes += Number(t.amount); }
    else { if (m === mesActual) gasMes += Number(t.amount); }
  });
  const balance = saldoTotal(estado);
  const ahorro = ingMes - gasMes;

  let y = 38;
  doc.setFillColor(22, 30, 49);
  doc.roundedRect(10, y, 190, 36, 4, 4, 'F');
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.text('BALANCE TOTAL', 20, y + 8);
  doc.text('INGRESOS MES', 75, y + 8);
  doc.text('GASTOS MES', 130, y + 8);
  doc.text('AHORRO MES', 170, y + 8);
  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(balance >= 0 ? 52 : 239, balance >= 0 ? 211 : 68, balance >= 0 ? 153 : 68);
  doc.text(`S/${balance.toFixed(2)}`, 20, y + 22);
  doc.setTextColor(52, 211, 153);
  doc.text(`S/${ingMes.toFixed(2)}`, 75, y + 22);
  doc.setTextColor(239, 68, 68);
  doc.text(`S/${gasMes.toFixed(2)}`, 130, y + 22);
  doc.setTextColor(ahorro >= 0 ? 52 : 239, ahorro >= 0 ? 211 : 68, ahorro >= 0 ? 153 : 68);
  doc.text(`S/${ahorro.toFixed(2)}`, 170, y + 22);

  y += 44;

  // ── Tabla de transacciones del mes ──
  const txMes = estado.transactions.filter((t) => (t.date || '').substring(0, 7) === mesActual);
  if (txMes.length > 0) {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.text('Movimientos de ' + mesLabel, 14, y);
    y += 4;

    const tableData = txMes.map((t) => [
      t.date || '',
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      (t.category || '').substring(0, 24),
      todasLasCuentas(estado).find((c) => c.id === (t.account || 'efectivo'))?.name || (t.account || ''),
      `S/${Number(t.amount).toFixed(2)}`,
      (t.description || '').substring(0, 30),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Tipo', 'Categoría', 'Cuenta', 'Monto', 'Descripción']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, textColor: [241, 245, 249], fillColor: [22, 30, 49], lineColor: [30, 41, 59] },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [15, 23, 42] },
      columnStyles: { 4: { halign: 'right' as const } },
      margin: { left: 10, right: 10 },
    });
  }

  // ── Footer con páginas (como el viejo) ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.text(`WalletTrack — Reporte generado el ${ahora} | No reemplaza asesoría financiera profesional`, 14, 290);
    doc.text(`Página ${i}/${pageCount}`, 210 - 14, 290, { align: 'right' });
  }

  const pdfNom = `WalletTrack_Reporte_${mesActual}.pdf`;
  const pdfBlob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
  await compartirArchivo(pdfBlob, pdfNom);
}
