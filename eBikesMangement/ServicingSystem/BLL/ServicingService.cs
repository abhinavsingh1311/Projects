
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ServicingSystem.DAL;
using ServicingSystem.Entities;

namespace SalesReturnSystem.BLL
{
	public class ServicingService
	{
		private readonly eBike_2025_Servicing_Context _context;

		internal ServicingService(eBike_2025_Servicing_Context context)
		{
			_context = context;
		}


	}
}
