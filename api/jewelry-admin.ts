import {cloudAdmin} from '../scripts/model-admin/cloud-admin.ts';

export default {
  fetch(request:Request){
    return cloudAdmin(request);
  },
};
