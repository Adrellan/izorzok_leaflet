import React from 'react';
import { Card } from 'primereact/card';

type Props = {
  title: string;
  children: React.ReactNode;
  onClick: () => void;
};

const ChartCard: React.FC<Props> = ({ title, children, onClick }) => {
  return (
    <Card 
      className="chart-card"
      style={{ 
        backgroundColor: '#334155',
        border: '1px solid #475569',
        cursor: 'pointer',
        transition: 'all 0.2s',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '40vh'
      }}
      onClick={onClick}
    >
      <div style={{ 
        height: '250px', 
        width: '100%',
        marginBottom: '12px',
        overflow: 'hidden'
      }}>
        {children}
      </div>
      <h4 style={{ 
        color: '#e2e8f0', 
        textAlign: 'center',
        marginTop: 40,
        fontSize: '14px',
        fontWeight: 500
      }}>
        {title}
      </h4>
    </Card>
  );
};

export default ChartCard;