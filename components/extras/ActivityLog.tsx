'use client'

import { useMemo, useState } from 'react'
import EmptyState from '@/components/EmptyState'
import Icon from '@/components/Icon'
import LocalTime from '@/components/LocalTime'
import { MOVEMENT_REASONS, TRANSACTION_TYPE_LABELS } from '@/lib/types'
import ChipGroup from './ChipGroup'
import {
  ALL,
  NO_REASON,
  UNKNOWN_STAFF,
  filterActivity,
  newestFirst,
  staffNames,
} from './activity'
import type { ExtrasContext } from './types'

export default function ActivityLog({ transactions }: ExtrasContext) {
  const [reason, setReason] = useState(ALL)
  const [staff, setStaff] = useState(ALL)

  // Across all transactions so a filtered transfer still names its partner.
  const byId = useMemo(
    () => new Map(transactions.map((t) => [t.id, t])),
    [transactions],
  )
  const names = useMemo(() => staffNames(transactions), [transactions])
  const rows = useMemo(
    () => filterActivity(newestFirst(transactions), { reason, staff }),
    [transactions, reason, staff],
  )

  return (
    <>
      <div className="history-filters">
        <ChipGroup
          name="x-reason"
          label="Reason"
          options={[
            [ALL, 'All reasons'],
            [NO_REASON, 'No reason given'],
            ...MOVEMENT_REASONS.map((r): [string, string] => [r, r]),
          ]}
          value={reason}
          onChange={setReason}
        />
        <ChipGroup
          name="x-staff"
          label="Staff"
          options={[
            [ALL, 'All staff'],
            [UNKNOWN_STAFF, 'Not recorded'],
            ...names.map((n): [string, string] => [n, n]),
          ]}
          value={staff}
          onChange={setStaff}
        />
      </div>

      <p className="result-count" aria-live="polite">
        Showing {rows.length} of {transactions.length} movements
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="No movements match these filters"
          hint="Try a different reason or staff member."
        />
      ) : (
        <div className="table-scroll" tabIndex={0} aria-label="Activity log table">
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Product</th>
                <th scope="col">Warehouse</th>
                <th scope="col">Type</th>
                <th scope="col" className="num">
                  Quantity
                </th>
                <th scope="col">Reason</th>
                <th scope="col">Staff</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const linked = t.linkedTransactionId
                  ? byId.get(t.linkedTransactionId)
                  : undefined
                return (
                  <tr key={t.id}>
                    <td className="tnum">
                      <LocalTime iso={t.timestamp} />
                    </td>
                    <td>
                      <span className="p-name">{t.productName}</span>
                      {linked && (
                        <span className="linked">
                          <Icon name="link" className="ic ic-xs" />
                          {t.type === 'TRANSFER_OUT' ? 'to' : 'from'}{' '}
                          {linked.warehouseName}
                        </span>
                      )}
                    </td>
                    <td>{t.warehouseName}</td>
                    <td>{TRANSACTION_TYPE_LABELS[t.type]}</td>
                    <td className="num">
                      <b>{t.quantity}</b>
                    </td>
                    <td>{t.reason ?? '—'}</td>
                    <td>{t.staffName ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
