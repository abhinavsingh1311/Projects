
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using SalesReturnSystem.DAL;
using SalesReturnSystem.Entities;

namespace SalesReturnSystem.BLL
{
	public class SalesReturnService
	{
		private readonly eBike_2025_SR_Context _context;

		internal SalesReturnService(eBike_2025_SR_Context context)
		{
			_context = context;
		}

	}
}
