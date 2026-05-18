export interface CompanyHoliday {
  id: string;
  date: string;
  name: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyHolidaysResponse {
  holidays: CompanyHoliday[];
}

export interface CreateCompanyHolidayRequest {
  date: string;
  name: string;
}

export interface UpdateCompanyHolidayRequest {
  date?: string;
  name?: string;
}
