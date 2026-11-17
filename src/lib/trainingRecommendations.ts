/** External training recommendations cleared per owner request.
 * Training Library now recommends only our own system programmes,
 * vacancies and partner offers — no third-party courses.
 */

export interface TrainingRecommendation {
  id: string;
  title: string;
  provider: string;
  level: string;
  duration: string;
  format: string;
  url: string;
  cost: string;
  bestFor: string;
  description: string;
}

export const RECOMMENDED_MODULES: TrainingRecommendation[] = [];
