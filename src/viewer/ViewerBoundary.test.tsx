import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {ViewerBoundary} from './ViewerBoundary';

describe('recoverable viewer',()=>{
  it('can retry a failed child without keeping the old error screen',()=>{
    vi.spyOn(console,'error').mockImplementation(()=>{});
    let failed=true;
    function Child(){if(failed)throw new Error('asset download failed');return <p>模型已载入</p>;}
    const onError=vi.fn();
    render(<ViewerBoundary onRetry={()=>{failed=false;}} onError={onError}><Child/></ViewerBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button',{name:'重新加载模型'}));
    expect(screen.getByText('模型已载入')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
