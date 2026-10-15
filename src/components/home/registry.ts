import type { ComponentType } from "react";
import type { HomeSectionKey } from "@/types";
import InstitutionSummarySection from "./InstitutionSummarySection";
import AboutSection from "./AboutSection";
import FeaturesSection from "./FeaturesSection";
import ImpactSection from "./ImpactSection";
import AdmissionsSection from "./AdmissionsSection";
import VerifySection from "./VerifySection";
import FaqSection from "./FaqSection";
import ContactSection from "./ContactSection";
import CtaBand from "./CtaBand";

/**
 * Maps each reorderable/hideable homepage section to its component. Every
 * component reads its copy from `w.home.sections[key]` plus its own CMS
 * list(s) (features, testimonials, admissionSteps…) — no hard-coded text.
 * Components accept a superset of props (copy, w, settings, onApply,
 * onLogin); each only destructures what it actually needs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const HOME_SECTION_REGISTRY: Record<HomeSectionKey, ComponentType<any>> = {
  summary: InstitutionSummarySection,
  about: AboutSection,
  features: FeaturesSection,
  impact: ImpactSection,
  admissions: AdmissionsSection,
  verify: VerifySection,
  faq: FaqSection,
  contact: ContactSection,
  cta: CtaBand,
};
