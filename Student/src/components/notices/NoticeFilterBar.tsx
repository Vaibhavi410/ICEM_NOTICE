import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { NoticeDateFilter } from './NoticeDateFilter';

interface CategoryOption {
  label: string;
  value: string;
}

interface NoticeFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
  categories?: CategoryOption[];
  hideCategoryPills?: boolean;
  selectedDepartment: string;
  onSelectDepartment: (dept: string) => void;
  showOnlyImportant: boolean;
  onToggleImportant: () => void;
  onResetFilters: () => void;
  totalCount: number;
  selectedDate?: string;
  onSelectDate?: (date?: string) => void;
  availableDates?: string[];
}

export const NoticeFilterBar: React.FC<NoticeFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  selectedCategory = 'all',
  onSelectCategory,
  categories: customCategories,
  hideCategoryPills = false,
  selectedDepartment,
  onSelectDepartment,
  showOnlyImportant,
  onToggleImportant,
  onResetFilters,
  totalCount,
  selectedDate,
  onSelectDate,
  availableDates,
}) => {
  const defaultCategories: CategoryOption[] = [
    { label: 'All', value: 'all' },
    { label: 'Academic', value: 'Academic' },
    { label: 'Examination', value: 'Examination' },
    { label: 'Placement', value: 'Placement' },
    { label: 'Events', value: 'Events' },
    { label: 'Administrative', value: 'Administrative' },
  ];

  const categories = customCategories || defaultCategories;

  const departments = [
    { label: 'All Departments', value: 'all' },
    { label: 'Computer Engineering', value: 'ce' },
    { label: 'Information Technology', value: 'it' },
    { label: 'Mechanical', value: 'mech' },
    { label: 'Civil', value: 'civil' },
    { label: 'ENTC', value: 'entc' },
  ];

  const hasActiveFilters =
    searchTerm !== '' ||
    (!hideCategoryPills && selectedCategory !== 'all') ||
    selectedDepartment !== 'all' ||
    showOnlyImportant ||
    !!selectedDate;

  return (
    <div className="flex flex-col gap-3 bg-white p-3 sm:p-4 rounded-xl border border-[#e2e6ec] shadow-2xs">
      {/* Top row: Search input, Department Select, Date Filter, Important Only */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-md min-w-0">
          <Search className="w-4 h-4 text-[#737782] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notices by title, keyword, or issuer..."
            className="w-full pl-9 pr-4 py-2 bg-[#f5f7fa] rounded-sm border border-[#e2e6ec] text-xs sm:text-sm text-[#1c1b1b] focus:bg-white focus:border-[#003c84] focus:outline-none transition-all placeholder:text-[#5c6470] placeholder:truncate"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737782] hover:text-[#1c1b1b] shrink-0"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {onSelectDate && (
            <NoticeDateFilter
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
              availableDates={availableDates}
            />
          )}

          <select
            value={selectedDepartment}
            onChange={(e) => onSelectDepartment(e.target.value)}
            className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-sm bg-[#f5f7fa] text-[#434751] text-xs sm:text-sm border border-[#e2e6ec] focus:border-[#003c84] focus:outline-none cursor-pointer font-medium"
          >
            {departments.map((dept) => (
              <option key={dept.value} value={dept.value}>
                {dept.label}
              </option>
            ))}
          </select>

          <button
            onClick={onToggleImportant}
            className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-sm text-xs sm:text-sm font-semibold transition-all border flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              showOnlyImportant
                ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs'
                : 'bg-[#f5f7fa] border-[#e2e6ec] text-[#434751] hover:bg-[#eae7e7]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${showOnlyImportant ? 'bg-amber-500' : 'bg-[#737782]'}`} />
            <span>Important Only</span>
          </button>

          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="text-xs text-[#003c84] hover:underline font-semibold px-2 py-1 flex items-center gap-1 shrink-0"
              title="Reset all filters"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Strip */}
      {!hideCategoryPills && onSelectCategory && (
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 hide-scrollbar pt-1 border-t border-[#e2e6ec]">
          <div className="flex items-center gap-1 mr-1 text-[#5c6470] shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Categories:</span>
          </div>

          {categories.map((cat) => {
            const isActive = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => onSelectCategory(cat.value)}
                className={`px-3 py-1 rounded-sm text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-[#003c84] text-white shadow-xs'
                    : 'bg-[#f5f7fa] text-[#434751] hover:bg-[#eae7e7] border border-transparent'
                }`}
              >
                {cat.label}
              </button>
            );
          })}

          <span className="ml-auto text-xs text-[#5c6470] font-medium shrink-0 pl-2">
            {totalCount} {totalCount === 1 ? 'Notice' : 'Notices'}
          </span>
        </div>
      )}
    </div>
  );
};
