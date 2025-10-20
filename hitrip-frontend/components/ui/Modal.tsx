"use client"

import type React from "react"
import { X } from "lucide-react"

/**
 * Modal 컴포넌트
 *
 * 일정 추가, 장소 추가 등의 모달 창을 구현하기 위한 컴포넌트
 *
 * 사용 예시:
 * <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="일정 추가">
 *   <form>...</form>
 * </Modal>
 */

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl"
}

export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  if (!isOpen) return null

  // 모달 크기 설정
  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 모달 컨텐츠 */}
      <div
        className={`relative bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} mx-4 max-h-[90vh] overflow-y-auto`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
