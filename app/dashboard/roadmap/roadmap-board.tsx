'use client'

import { useState, useCallback } from 'react'
import { Client, PipelineStage } from '@/lib/types'
import { t } from '@/lib/tokens'
import { StageColumn } from './stage-column'
import { ClientPanel } from './client-panel'

interface RoadmapBoardProps {
  initialBoard: Record<PipelineStage, Client[]>
  stageLabels: Record<PipelineStage, string>
  stageOrder: PipelineStage[]
}

export function RoadmapBoard({ initialBoard, stageLabels, stageOrder }: RoadmapBoardProps) {
  const [board, setBoard] = useState(initialBoard)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [dragging, setDragging] = useState<{ client: Client; fromStage: PipelineStage } | null>(null)

  const handleDragStart = useCallback((client: Client, fromStage: PipelineStage) => {
    setDragging({ client, fromStage })
  }, [])

  const handleDrop = useCallback(async (toStage: PipelineStage) => {
    if (!dragging || dragging.fromStage === toStage) {
      setDragging(null)
      return
    }

    const { client, fromStage } = dragging

    // Optimistic update
    setBoard(prev => {
      const next = { ...prev }
      next[fromStage] = prev[fromStage].filter(c => c.id !== client.id)
      next[toStage] = [{ ...client, pipeline_stage: toStage }, ...prev[toStage]]
      return next
    })
    setDragging(null)

    // Persist
    try {
      await fetch(`/api/roadmap/${client.id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: toStage }),
      })
    } catch {
      // Rollback on error
      setBoard(prev => {
        const next = { ...prev }
        next[toStage] = prev[toStage].filter(c => c.id !== client.id)
        next[fromStage] = [client, ...prev[fromStage]]
        return next
      })
    }
  }, [dragging])

  const handleClientUpdated = useCallback((updated: Client) => {
    setBoard(prev => {
      const next = { ...prev }
      stageOrder.forEach(stage => {
        next[stage] = prev[stage].map(c => c.id === updated.id ? updated : c)
      })
      return next
    })
    setSelectedClient(updated)
  }, [stageOrder])

  return (
    <div style={{ position: 'relative' }}>
      {/* Board */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${stageOrder.length}, minmax(200px, 1fr))`,
        gap: 12,
        overflowX: 'auto',
        paddingBottom: 8,
      }}>
        {stageOrder.map(stage => (
          <StageColumn
            key={stage}
            stage={stage}
            label={stageLabels[stage]}
            clients={board[stage]}
            isDragOver={dragging !== null}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onClientClick={setSelectedClient}
          />
        ))}
      </div>

      {/* Side panel */}
      {selectedClient && (
        <ClientPanel
          client={selectedClient}
          stageLabels={stageLabels}
          stageOrder={stageOrder}
          onClose={() => setSelectedClient(null)}
          onClientUpdated={handleClientUpdated}
        />
      )}

      {/* Overlay when panel is open */}
      {selectedClient && (
        <div
          onClick={() => setSelectedClient(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 49,
          }}
        />
      )}

      {/* Drag overlay hint */}
      {dragging && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: t.bg.cardSolid,
          border: `1px solid ${t.border.default}`,
          borderRadius: 8, padding: '8px 16px',
          fontSize: 12, color: t.text.secondary,
          pointerEvents: 'none', zIndex: 100,
        }}>
          Upuść na kolumnę aby zmienić etap
        </div>
      )}
    </div>
  )
}
