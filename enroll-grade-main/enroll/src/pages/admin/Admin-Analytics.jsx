import './admin_analytics.css';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { Sub_Nav } from '../../components/SubNav';
import { useState } from 'react';

export const Admin_Analytics = () => {
  const [activeSection, setActiveSection] = useState('enrollmentForecast');

  return (
    <>
      <Header />
      <Navigation_Bar userRole="super_admin" />
      <Sub_Nav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <div className="analyticsContainer">
        {activeSection === 'enrollmentForecast' && (
          <div className="enrollmentForecast">
            <h2>Projected Total Enrollees</h2>
            <div className="enrollmentForecastSorter">
              <div className="sorter">
                <label>Grade Level</label>
                <select>
                  <option>Grade 7</option>
                  <option>Grade 8</option>
                  <option>Grade 9</option>
                  <option>Grade 10</option>
                </select>
              </div>
            </div>
            <div className="statChartContainer">
              <div className="enrollmentForecastGraph">
                <h2>Graph</h2>
              </div>
              <div className="cardSection">
                <div className="enrollmentForecastCard">
                  <p className="yearStat">2026-2027 Projected Total:</p>
                  <h2>595 - 600</h2>
                  <p>students are expected to enroll.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'dropoutTrend' && (
          <div className="dropoutTrend">
            <h2>Non-completion Trend</h2>
            <div className="enrollmentForecastSorter">
              <div className="sorter">
                <label>Grade Level</label>
                <select>
                  <option>Grade 7</option>
                  <option>Grade 8</option>
                  <option>Grade 9</option>
                  <option>Grade 10</option>
                </select>
              </div>
            </div>
            <div className="statChartContainer">
              <div className="dropoutTrendGraph"></div>
              <div className="cardSection">
                <div className="dropoutTrendCard">
                  <p className="yearStat">2026-2027 Projected Average:</p>
                  <h2>10 - 25</h2>
                  <p>students might drop out.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'gradePerformance' && (
          <div className="gradePerformance">
            <h2>School Grade Performance</h2>
            <p>Average final grade across all subjects:</p>
            <div className="gradePerformanceSorter">
              <div className="sorter">
                <label>Grade Level</label>
                <select>
                  <option>Grade 7</option>
                  <option>Grade 8</option>
                  <option>Grade 9</option>
                  <option>Grade 10</option>
                </select>
              </div>
            </div>
            <div className="statChartContainer">
              <div className="gradePerformanceTable">
                <table>
                  <thead>
                    <tr>
                      <th>School Year</th>
                      <th>Average Final Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>2022-2023</td>
                      <td>81.3</td>
                    </tr>
                    <tr>
                      <td>2023-2024</td>
                      <td>81.3</td>
                    </tr>
                    <tr>
                      <td>2024-2025</td>
                      <td>81.3</td>
                    </tr>
                    <tr>
                      <td>2025-2026</td>
                      <td>81.3</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>
                        <strong>
                          Projected Average:
                          <br /> 2026-2027
                        </strong>
                      </td>
                      <td>~81.3</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="cardSection">
                <div className="gradePerformanceCard">
                  <p className="yearStat">2026-2027 Projected Average:</p>
                  <h2>10 - 25</h2>
                  <p>students might drop out.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
