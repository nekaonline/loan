"use client";

import { useEffect, useRef, useState } from "react";
import {
  eachDayOfInterval,
  endOfMonth as endOfJalaliMonth,
  getDate as getJalaliDate,
  getDay as getJalaliDay,
  getMonth as getJalaliMonth,
  getYear as getJalaliYear,
  startOfMonth as startOfJalaliMonth,
} from "date-fns-jalali";
import {
  addJalaliMonthsISO,
  formatJalaliInput,
  getIranTodayISO,
  parseISODate,
  toISODate,
  toPersianDigits,
} from "@/lib/utils";

const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

// date-fns-jalali getDay(): 0 = Sunday, 6 = Saturday. The calendar starts on Saturday.
const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

interface JalaliDatePickerProps {
  /** Gregorian `YYYY-MM-DD` key (the format stored in the database). */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function JalaliDatePicker({
  value,
  onChange,
  id,
  placeholder = "۱۴۰۵/۰۱/۰۱",
  required = false,
  disabled = false,
  className = "",
}: JalaliDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() =>
    parseISODate(value || getIranTodayISO())
  );
  const rootRef = useRef<HTMLDivElement>(null);

  function openPicker() {
    if (value) setView(parseISODate(value));
    setOpen(true);
  }

  useEffect(() => {
    function handleOutsideClick(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const firstDay = startOfJalaliMonth(view);
  const days = eachDayOfInterval({
    start: firstDay,
    end: endOfJalaliMonth(view),
  });
  const leadingBlanks = (getJalaliDay(firstDay) + 1) % 7;
  const todayISO = getIranTodayISO();
  const jalaliYear = getJalaliYear(view);
  const jalaliMonth = getJalaliMonth(view);

  function selectDay(day: Date) {
    onChange(toISODate(day));
    setOpen(false);
  }

  function moveMonth(delta: number) {
    const nextMonth = addJalaliMonthsISO(toISODate(firstDay), delta);
    if (nextMonth) setView(parseISODate(nextMonth));
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          readOnly
          disabled={disabled}
          required={required}
          value={formatJalaliInput(value)}
          placeholder={placeholder}
          onClick={() => !disabled && openPicker()}
          className="form-input pl-10 cursor-pointer"
          aria-label="تاریخ هجری شمسی"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openPicker())}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-lg leading-none text-slate-500 hover:text-blue-700 disabled:opacity-50"
          aria-label="انتخاب تاریخ از تقویم"
        >
          📅
        </button>
      </div>

      {open && !disabled && (
        <div
          dir="rtl"
          role="dialog"
          aria-label="تقویم هجری شمسی"
          className="absolute left-0 z-[70] mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="h-8 w-8 rounded-lg text-lg text-slate-600 hover:bg-slate-100"
              aria-label="ماه قبل"
            >
              ›
            </button>
            <div className="font-semibold text-slate-800">
              {PERSIAN_MONTHS[jalaliMonth]} {toPersianDigits(jalaliYear)}
            </div>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="h-8 w-8 rounded-lg text-lg text-slate-600 hover:bg-slate-100"
              aria-label="ماه بعد"
            >
              ‹
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold text-slate-400">
            {WEEKDAYS.map((day, index) => (
              <div key={`${day}-${index}`}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingBlanks }, (_, index) => (
              <div key={`blank-${index}`} />
            ))}
            {days.map((day) => {
              const iso = toISODate(day);
              const isSelected = iso === value;
              const isToday = iso === todayISO;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`flex h-9 items-center justify-center rounded-lg text-sm transition-colors ${
                    isSelected
                      ? "bg-blue-700 font-bold text-white"
                      : isToday
                      ? "bg-blue-50 font-bold text-blue-700 ring-1 ring-blue-300"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  aria-pressed={isSelected}
                >
                  {toPersianDigits(getJalaliDate(day))}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
            <button
              type="button"
              onClick={() => selectDay(parseISODate(todayISO))}
              className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-200"
            >
              امروز
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="rounded-lg px-3 py-1.5 text-slate-500 hover:bg-slate-100"
              >
                حذف تاریخ
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
