"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface MentionData {
  mentioned_user_id: string;
  field_type: string;
  field_index: number;
  snippet: string;
}

export interface Profile {
  id: string;
  full_name: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string, mentions: MentionData[]) => void;
  onBlur?: () => void;
  placeholder?: string;
  profiles: Profile[];
  fieldType: string;
  fieldIndex: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MentionInput({
  value,
  onChange,
  onBlur,
  placeholder,
  profiles,
  fieldType,
  fieldIndex,
}: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentions, setMentions] = useState<MentionData[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered =
    profiles.length === 0
      ? []
      : profiles.filter((p) =>
          p.full_name.toLowerCase().includes(query.toLowerCase())
        );

  const closeMention = useCallback(() => {
    setShowDropdown(false);
    setQuery("");
    setMentionStart(null);
    setActiveIndex(0);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        closeMention();
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown, closeMention]);

  function selectProfile(profile: Profile) {
    if (mentionStart === null) return;

    const before = value.slice(0, mentionStart);
    const after = value.slice(mentionStart + 1 + query.length);
    const newValue = before + profile.full_name + after;

    const newMention: MentionData = {
      mentioned_user_id: profile.id,
      field_type: fieldType,
      field_index: fieldIndex,
      snippet: newValue,
    };

    const updatedMentions = [...mentions, newMention];
    setMentions(updatedMentions);
    onChange(newValue, updatedMentions);
    closeMention();

    // Restore focus and cursor position
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const cursorPos = before.length + profile.full_name.length;
        inputRef.current.setSelectionRange(cursorPos, cursorPos);
      }
    }, 0);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? newValue.length;

    // Prune stale mentions (names no longer in the text)
    const prunedMentions = mentions.filter((m) => {
      const profile = profiles.find((p) => p.id === m.mentioned_user_id);
      return profile && newValue.includes(profile.full_name);
    });
    if (prunedMentions.length !== mentions.length) {
      setMentions(prunedMentions);
      onChange(newValue, prunedMentions);
      // Don't return — still need to check for new @ trigger below
    }

    // Check if we should open/update the mention dropdown
    const textUpToCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textUpToCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      // Make sure the @ is either at the start or preceded by a space
      const charBefore = lastAtIndex > 0 ? newValue[lastAtIndex - 1] : " ";
      if (charBefore === " " || lastAtIndex === 0) {
        const partial = textUpToCursor.slice(lastAtIndex + 1);
        // Only show dropdown if partial doesn't contain a space (simple heuristic)
        if (!partial.includes(" ") || partial.length === 0) {
          setMentionStart(lastAtIndex);
          setQuery(partial);
          setShowDropdown(true);
          setActiveIndex(0);
        } else {
          closeMention();
        }
      } else {
        closeMention();
      }
    } else {
      closeMention();
    }

    onChange(newValue, mentions);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0 && activeIndex < filtered.length) {
        selectProfile(filtered[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMention();
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const activeEl = dropdownRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex, showDropdown]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        className="border border-input rounded-lg h-10 px-3 text-sm bg-transparent w-full outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground transition-colors"
      />
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-md max-h-48 overflow-y-auto z-50"
        >
          {profiles.length === 0 ? (
            <div className="py-2 px-3 text-sm text-muted-foreground">
              Loading team members...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-2 px-3 text-sm text-muted-foreground">
              No matching team members
            </div>
          ) : (
            filtered.map((profile, i) => (
              <div
                key={profile.id}
                className={`py-2 px-3 cursor-pointer text-sm flex items-center gap-2 ${
                  i === activeIndex ? "bg-background" : "hover:bg-background"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectProfile(profile);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <div className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {getInitials(profile.full_name)}
                </div>
                <span>{profile.full_name}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
