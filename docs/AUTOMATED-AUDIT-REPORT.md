# Reporte de Auditoría Estática Automatizada de Código Financiero

Generado de forma automática por el Auditor Principal de Antigravity.
Fecha: 2026-07-12T15:03:26.400Z

---

## Resumen de Hallazgos

| Categoría | Total Hallazgos | Descripción |
|---|---|---|
| Aritmética de Coma Flotante (`+ - * /`) | 58 | Posible uso de aritmética imprecisa nativa de JS en variables monetarias. |
| Claves / Secretos Harcodeados | 2 | Credenciales, tokens o PINs expuestos en el código fuente. |
| Conversiones Numéricas Inseguras | 26 | Uso de `Number()` o `parseFloat()` en importes monetarios sin validar `NaN`. |

---

## Aritmética de Coma Flotante detectada

- **Archivo:** [App.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/App.tsx) (Línea 729)
  - **Código:** `.reduce((sum, a) => sum + (a.initialBalance || 0), 0)`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [App.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/App.tsx) (Línea 1484)
  - **Código:** `.reduce((sum, a) => sum + (a.initialBalance || 0), 0)`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [ConsolidationTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/consolidation/ConsolidationTab.tsx) (Línea 192)
  - **Código:** `? `Ahorras ${formatAmount(currentConsolidatedMonthlySum - newConsolidatedCuota)}/mes respecto a deudas previas``
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [ConsolidationTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/consolidation/ConsolidationTab.tsx) (Línea 223)
  - **Código:** `{formatAmount(newConsolidatedInterests - currentTotalInterests)}`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [OverviewTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/dashboard/OverviewTab.tsx) (Línea 191)
  - **Código:** `const cumValues = [0, totalIncomes, totalIncomes - totalExpenses, netMonthlyBalance];`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [OverviewTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/dashboard/OverviewTab.tsx) (Línea 604)
  - **Código:** `{Math.abs((steps[hoveredIndex].amount / totalIncomes) * 100).toFixed(1)}%`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [OverviewTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/dashboard/OverviewTab.tsx) (Línea 639)
  - **Código:** `const pct = ((amount / (totalExpenses + totalMonthlyDebtPayments)) * 100).toFixed(0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [OverviewTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/dashboard/OverviewTab.tsx) (Línea 651)
  - **Código:** `style={{ width: `${(amount / maxTagAmount) * 100}%` }}`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [OverviewTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/dashboard/OverviewTab.tsx) (Línea 693)
  - **Código:** `Aportación correspondiente: {formatAmount(jointPaidByA / 2)} por persona`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [OverviewTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/dashboard/OverviewTab.tsx) (Línea 705)
  - **Código:** `Aportación correspondiente: {formatAmount(jointPaidByB / 2)} por persona`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [OverviewTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/dashboard/OverviewTab.tsx) (Línea 762)
  - **Código:** `: calculateClassicDebtInstallment(d) * d.termMonths - d.principal;`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [OverviewTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/dashboard/OverviewTab.tsx) (Línea 804)
  - **Código:** `: `${d.termMonths}m / ${getDebtRateLabel(d)}`}`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [DebtsTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/debts/DebtsTab.tsx) (Línea 70)
  - **Código:** `const paymentPlanTotalToPay = Math.abs(toNumber(debtForm.financedAmount)) + Math.abs(toNumber(debtForm.fees));`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [DebtsTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/debts/DebtsTab.tsx) (Línea 72)
  - **Código:** `(sum, t) => sum + Math.abs(toNumber(t.months)) * Math.abs(toNumber(t.amount)),`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [DebtsTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/debts/DebtsTab.tsx) (Línea 735)
  - **Código:** `{formatAmount(installment.amount + recurringCosts)}`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [TransactionsTab.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/transactions/TransactionsTab.tsx) (Línea 881)
  - **Código:** `const netChange = (toW - fromW) * txAmount;`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [FinanzasContext.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/context/FinanzasContext.tsx) (Línea 569)
  - **Código:** `: firstPeriod.openingBalance / 2`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [FinanzasContext.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/context/FinanzasContext.tsx) (Línea 574)
  - **Código:** `: firstPeriod.openingBalance / 2`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [FinanzasContext.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/context/FinanzasContext.tsx) (Línea 729)
  - **Código:** `.reduce((sum, t) => sum + getEffectiveAmountWrapper(t), 0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [FinanzasContext.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/context/FinanzasContext.tsx) (Línea 733)
  - **Código:** `.reduce((sum, t) => sum + getEffectiveAmountWrapper(t), 0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [FinanzasContext.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/context/FinanzasContext.tsx) (Línea 737)
  - **Código:** `.reduce((sum, t) => sum + getEffectiveAmountWrapper(t), 0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [FinanzasContext.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/context/FinanzasContext.tsx) (Línea 741)
  - **Código:** `.reduce((sum, t) => sum + getEffectiveAmountWrapper(t), 0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [FinanzasContext.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/context/FinanzasContext.tsx) (Línea 759)
  - **Código:** `.reduce((sum, t) => sum + toNumber(t.money?.amount ?? '0'), 0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [FinanzasContext.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/context/FinanzasContext.tsx) (Línea 763)
  - **Código:** `.reduce((sum, t) => sum + toNumber(t.money?.amount ?? '0'), 0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [FinanzasContext.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/context/FinanzasContext.tsx) (Línea 783)
  - **Código:** `return sum + calculateDebtRemainingPrincipal(d, selectedMonth);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [FinanzasContext.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/context/FinanzasContext.tsx) (Línea 787)
  - **Código:** `const totalNewPrincipal = consolidatedPrincipal + additionalCapital;`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [FinanzasContext.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/context/FinanzasContext.tsx) (Línea 804)
  - **Código:** `newConsolidatedCuota * Math.trunc(toNumber(consolidationForm.termMonths || '1'));`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [FinanzasContext.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/context/FinanzasContext.tsx) (Línea 805)
  - **Código:** `const newConsolidatedInterests = Math.max(0, newTotalConsolidatedPayment - totalNewPrincipal);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [FinanzasContext.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/context/FinanzasContext.tsx) (Línea 907)
  - **Código:** `const totalBalance = normalizedAccounts.reduce((sum, account) => sum + account.initialBalance, 0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [useDebts.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/hooks/useDebts.ts) (Línea 171)
  - **Código:** `const totalToPay = financedAmount + fees;`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [useDebts.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/hooks/useDebts.ts) (Línea 173)
  - **Código:** `(sum, tranche) => sum + Math.trunc(toNumber(tranche.months)) * Math.abs(toNumber(tranche.amount)),`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [useSecurity.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/hooks/useSecurity.ts) (Línea 174)
  - **Código:** `: firstPeriod.openingBalance / 2`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [useSecurity.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/hooks/useSecurity.ts) (Línea 179)
  - **Código:** `: firstPeriod.openingBalance / 2`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 232)
  - **Código:** `.reduce((sum, item) => sum + item.amount, 0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 238)
  - **Código:** `.reduce((sum, item) => sum + item.amount, 0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 259)
  - **Código:** `label: `Tramo ${trancheIndex + 1} · Cuota ${monthIndex + 1}``
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 273)
  - **Código:** `const r = toNumber(annualRate) / 100;`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 292)
  - **Código:** `if (monthlyRateNum === 0) return pNum / mNum;`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 304)
  - **Código:** `const paymentNum = pNum * (monthlyRateNum / (1 - (1 + monthlyRateNum) ** -mNum));`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 331)
  - **Código:** `return getPaymentPlanDueInstallments(debt, month).reduce((sum, installment) => sum + installment.amount, 0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 337)
  - **Código:** `.reduce((sum, installment) => sum + installment.amount, 0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 355)
  - **Código:** `return dueInstallments.reduce((sum, installment) => sum + installment.amount + recurringCosts, 0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 383)
  - **Código:** `return scheduled.reduce((sum, installment) => sum + installment.amount, 0) + recurringCosts;`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 454)
  - **Código:** `return previousRows[previousRows.length - 1].remainingPrincipal;`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 468)
  - **Código:** `.reduce((sum, inst) => sum + inst.amount, 0);`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 863)
  - **Código:** `if (owner === 'joint') return rawPrincipal * 0.5;`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 868)
  - **Código:** `if (owner === 'joint') return rawPrincipal * 0.5;`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [statementImportService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/statementImportService.ts) (Línea 706)
  - **Código:** `const sameAmount = Math.abs(existingAmount - importedAmount) < 0.001;`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [storageService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/storageService.ts) (Línea 259)
  - **Código:** `: firstPeriod.openingBalance / 2`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [storageService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/storageService.ts) (Línea 264)
  - **Código:** `: firstPeriod.openingBalance / 2`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [storageService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/storageService.ts) (Línea 403)
  - **Código:** `label: String(installment?.label ?? `Cuota ${index + 1}`)`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [storageService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/storageService.ts) (Línea 408)
  - **Código:** `const totalToPay = Math.abs(toNumber(rawDebt.totalToPay)) || financedAmount + fees;`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [storageService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/storageService.ts) (Línea 703)
  - **Código:** `: openingBalance / 2,`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [storageService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/storageService.ts) (Línea 707)
  - **Código:** `: openingBalance / 2,`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [storageService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/storageService.ts) (Línea 822)
  - **Código:** `: openingBalance / 2,`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [storageService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/storageService.ts) (Línea 826)
  - **Código:** `: openingBalance / 2,`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [storageService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/storageService.ts) (Línea 1038)
  - **Código:** `period.openingBalanceA !== undefined ? toNumber(period.openingBalanceA) : openingBalance / 2,`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

- **Archivo:** [storageService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/storageService.ts) (Línea 1040)
  - **Código:** `period.openingBalanceB !== undefined ? toNumber(period.openingBalanceB) : openingBalance / 2`
  - **Motivo:** Posible aritmética de coma flotante en variable financiera.

## Claves / Secretos Harcodeados

- **Archivo:** [useSecurity.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/hooks/useSecurity.ts) (Línea 26)
  - **Código:** `const PASSWORD_SALT_KEY = 'finanzas_v3_password_salt';`
  - **Motivo:** Posible clave secreta o token harcodeado.

- **Archivo:** [useSecurity.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/hooks/useSecurity.ts) (Línea 27)
  - **Código:** `const PASSWORD_CHECK_KEY = 'finanzas_v3_password_check';`
  - **Motivo:** Posible clave secreta o token harcodeado.

## Conversiones Numéricas Inseguras

- **Archivo:** [ImportStatementModal.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/transactions/ImportStatementModal.tsx) (Línea 1381)
  - **Código:** `? `${parseFloat(tx.balance).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €``
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [ImportStatementModal.tsx](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/components/transactions/ImportStatementModal.tsx) (Línea 1513)
  - **Código:** `{parseFloat(tx.amount).toFixed(2)} €`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [useAccounts.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/hooks/useAccounts.ts) (Línea 58)
  - **Código:** `initialBalance: Math.abs(parseFloat(accountForm.initialBalance) || 0)`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [useAccounts.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/hooks/useAccounts.ts) (Línea 69)
  - **Código:** `const updatedBalance = Math.abs(parseFloat(accountForm.initialBalance) || 0);`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [useDebts.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/hooks/useDebts.ts) (Línea 107)
  - **Código:** `const principalVal = parseFloat(debtForm.principal);`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [useTransactions.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/hooks/useTransactions.ts) (Línea 130)
  - **Código:** `const amountVal = parseFloat(formToUse.amount);`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [useTransactions.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/hooks/useTransactions.ts) (Línea 171)
  - **Código:** `amount: Math.abs(parseFloat(formToUse.amount)).toFixed(2),`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [useTransactions.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/hooks/useTransactions.ts) (Línea 242)
  - **Código:** `const updatedAmount = Math.abs(parseFloat(formToUse.amount));`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 763)
  - **Código:** `closingAccBalancesNum[key] = parseFloat(runningAccountBalances[key].toFixed(2));`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 769)
  - **Código:** `openingBalance: parseFloat(openingBalance.toFixed(2)),`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 773)
  - **Código:** `netBalance: parseFloat(netBalance.toFixed(2)),`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 774)
  - **Código:** `closingBalance: parseFloat(closingBalance.toFixed(2)),`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 831)
  - **Código:** `amount: parseFloat(amount.toFixed(2))`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [financeService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/financeService.ts) (Línea 1005)
  - **Código:** `netBalance: parseFloat(projectedNetRecurringFlow.minus(projectedDebtPayments).toFixed(2))`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [statementImportService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/statementImportService.ts) (Línea 703)
  - **Código:** `const existingAmount = existing.money?.amount ? parseFloat(existing.money.amount) : 0;`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [statementImportService.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/services/statementImportService.ts) (Línea 704)
  - **Código:** `const importedAmount = parseFloat(imported.amount);`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [backupValidator.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/utils/backupValidator.ts) (Línea 94)
  - **Código:** `const initialBalance = validateNumber(rawAcc.initialBalance, `${prefix}.initialBalance`);`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [backupValidator.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/utils/backupValidator.ts) (Línea 128)
  - **Código:** `const parsedAmount = parseFloat(moneyAmountStr);`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [backupValidator.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/utils/backupValidator.ts) (Línea 129)
  - **Código:** `const amountVal = validateNumber(Number.isFinite(parsedAmount) ? parsedAmount : 0, `${prefix}.amount`, true);`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [backupValidator.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/utils/backupValidator.ts) (Línea 238)
  - **Código:** `? validateNumber(rawDebt.chargeDay, `${prefix}.chargeDay`, true, true)`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [backupValidator.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/utils/backupValidator.ts) (Línea 254)
  - **Código:** `const principal = validateNumber(rawDebt.principal, `${prefix}.principal`, true);`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [backupValidator.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/utils/backupValidator.ts) (Línea 279)
  - **Código:** `const fees = validateNumber(rawDebt.fees, `${prefix}.fees`, true);`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [backupValidator.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/utils/backupValidator.ts) (Línea 302)
  - **Código:** `const amount = validateNumber(rawInst.amount, `${instPrefix}.amount`, true);`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [backupValidator.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/utils/backupValidator.ts) (Línea 358)
  - **Código:** `const openingBalance = validateNumber(rawPeriod.openingBalance, `${prefix}.openingBalance`);`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [backupValidator.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/utils/backupValidator.ts) (Línea 359)
  - **Código:** `const openingBalanceA = validateNumber(rawPeriod.openingBalanceA, `${prefix}.openingBalanceA`);`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

- **Archivo:** [backupValidator.ts](file:///C:/Users/sn4ke/dev/activos/finanzas-snake/src/utils/backupValidator.ts) (Línea 360)
  - **Código:** `const openingBalanceB = validateNumber(rawPeriod.openingBalanceB, `${prefix}.openingBalanceB`);`
  - **Motivo:** Conversión numérica directa (Number/parseFloat) de campo financiero sin validación NaN explícita.

